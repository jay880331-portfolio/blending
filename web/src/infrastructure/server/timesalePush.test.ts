import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ConflictError,
  sendTimesalePush,
  findTimesaleRecipientUserIds,
} from "./timesalePush";
import { MongoClient } from "mongodb";
import type { BaristaShowroom, ShowroomCoupon } from "@/domain/showroom/types";

describe("timesalePush", () => {
  const showroom: BaristaShowroom = {
    id: "showroom-1",
    userId: "barista-1",
    storeName: "성수 블렌딩",
    bioMessage: "향긋한 스페셜티 커피",
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
  };

  it("throws an error when attempting to push a non-timesale coupon", async () => {
    const regularCoupon: ShowroomCoupon = {
      id: "coupon-reg-1",
      baristaId: "barista-1",
      showroomId: "showroom-1",
      title: "일반 1000원 할인",
      discountDetail: "모든 음료 1000원 할인",
      validUntil: "2026-10-13T00:00:00.000Z",
      couponType: "regular",
      createdAt: "2026-09-13T00:00:00.000Z",
      updatedAt: "2026-09-13T00:00:00.000Z",
    };

    await assert.rejects(
      sendTimesalePush({ showroom, coupon: regularCoupon }),
      /타임세일 쿠폰만 타임세일 푸시를 발송할 수 있습니다/,
    );
  });

  it("rejects with ConflictError (409) if the coupon was pushed within 1 hour", async () => {
    const recentPushedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10분 전
    const timesaleCoupon: ShowroomCoupon = {
      id: "coupon-ts-1",
      baristaId: "barista-1",
      showroomId: "showroom-1",
      title: "타임세일 2000원 할인",
      discountDetail: "지금 방문 시 2000원 할인",
      validUntil: "2026-09-13T05:00:00.000Z",
      couponType: "timesale",
      lastPushedAt: recentPushedAt,
      createdAt: "2026-09-13T00:00:00.000Z",
      updatedAt: "2026-09-13T00:00:00.000Z",
    };

    await assert.rejects(
      sendTimesalePush({ showroom, coupon: timesaleCoupon }),
      (err: unknown) => {
        assert.ok(err instanceof ConflictError);
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /1시간 후에 다시 발송할 수 있습니다/);
        return true;
      },
    );
  });
});

it(
  "푸시 대상은 마케팅·야간·위치 동의와 24시간 제한을 지킨다",
  { skip: !process.env.COUPON_TEST_MONGODB_URI },
  async () => {
    const uri = process.env.COUPON_TEST_MONGODB_URI!;
    assert.match(uri, /^mongodb:\/\/(localhost|127\.0\.0\.1):/);
    const client = await MongoClient.connect(uri);
    const db = client.db(`coupon_push_test_${process.pid}_${Date.now()}`);
    try {
      const ids = [
        "day",
        "night",
        "optout",
        "limited",
        "disabled",
        "nearby",
        "no-location-consent",
      ];
      await db.collection("users").insertMany(
        ids.map((id) => ({
          id,
          accountStatus: id === "disabled" ? "suspended" : "active",
        })),
      );
      await db
        .collection("member_favorites")
        .insertMany(
          ids.slice(0, 5).map((ownerId) => ({ ownerId, id: "owner" })),
        );
      await db.collection("member_notification_settings").insertMany(
        ids.map((ownerId) => ({
          ownerId,
          settings: {
            benefitsMarketing: ownerId !== "optout",
            nightNotifications: ownerId === "night",
            shareLocationForTimesale: ownerId === "nearby",
          },
        })),
      );
      const now = new Date("2026-10-20T03:00:00Z");
      await db
        .collection<{
          _id: string;
          nextAllowedAt: Date;
        }>("coupon_push_frequency")
        .insertOne({
          _id: "limited",
          nextAllowedAt: new Date("2026-10-21T03:00:00Z"),
        });
      await db.collection("member_last_locations").insertMany(
        ["nearby", "no-location-consent"].map((userId) => ({
          userId,
          updatedAt: now,
          location: { type: "Point", coordinates: [127, 37] },
        })),
      );
      const options = {
        baristaId: "owner",
        storeLocation: { latitude: 37, longitude: 127, address: "테스트" },
        database: db,
        now,
      };
      assert.deepEqual(
        (
          await findTimesaleRecipientUserIds({
            ...options,
            audience: "regulars",
          })
        ).sort(),
        ["day", "night"],
      );
      assert.deepEqual(
        await findTimesaleRecipientUserIds({ ...options, audience: "nearby" }),
        ["nearby"],
      );
      assert.deepEqual(
        await findTimesaleRecipientUserIds({
          ...options,
          now: new Date("2026-10-20T12:00:00Z"),
        }),
        ["night"],
      );
    } finally {
      await db.dropDatabase();
      await client.close();
    }
  },
);
