import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { MongoClient, type Db } from "mongodb";
import { toKstDateKey } from "@/domain/passport/ledger";
import { ensurePassportIndexes } from "@/infrastructure/mongodb/passportIndexes";
import {
  BeanReservationError,
  createBeanReservation,
  transitionBeanReservation,
} from "./beanReservationRepository";

// 독립된 로컬 replica set 전용. 운영 DB에는 접속하지 않는다.
const uri = process.env.COUPON_TEST_MONGODB_URI;

describe("원두·드립백 예약 MongoDB 인덱스·동시성·권한", { skip: !uri }, () => {
  let client: MongoClient;
  let db: Db;

  before(async () => {
    assert.match(uri!, /^mongodb:\/\/(127\.0\.0\.1|localhost):/);
    client = await MongoClient.connect(uri!);
    db = client.db(`bean_reservation_test_${process.pid}_${Date.now()}`);
    await ensurePassportIndexes(db);
  });

  after(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  beforeEach(async () => {
    await Promise.all(
      [
        "users",
        "barista_showrooms",
        "coupon_store_staff",
        "showroom_beans",
        "bean_reservations",
        "member_notifications",
      ].map((name) => db.collection(name).deleteMany({})),
    );

    await db.collection("users").insertMany([
      {
        id: "owner-1",
        name: "사장1",
        role: "barista",
        accountStatus: "active",
      },
      {
        id: "staff-1",
        name: "직원1",
        role: "barista",
        accountStatus: "active",
      },
      {
        id: "customer-1",
        name: "고객1",
        role: "enthusiast",
        accountStatus: "active",
      },
    ]);

    await db.collection("barista_showrooms").insertOne({
      id: "store-1",
      userId: "owner-1",
      storeName: "블렌딩 로스터리",
      address: "서울",
      latitude: 37.5,
      longitude: 127.0,
      images: [],
      businessVerification: {
        number: "2208162517",
        status: "VERIFIED",
        submittedAt: "2026-01-01T00:00:00.000Z",
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    await db.collection("coupon_store_staff").insertOne({
      id: "staff-link-1",
      storeId: "store-1",
      userId: "staff-1",
      grantedBy: "owner-1",
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await db.collection("showroom_beans").insertOne({
      id: "bean-1",
      storeId: "store-1",
      baristaId: "owner-1",
      kind: "bean",
      name: "에티오피아 예가체프",
      notes: "자스민",
      unit: "200g",
      price: 18000,
      grindOptions: ["whole", "drip"],
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("동시 5건 예약 요청 시 부분 고유 인덱스로 1건만 생성되고 4건은 409를 반환한다", async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const pickupDate = toKstDateKey(tomorrow);

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        createBeanReservation(
          "customer-1",
          "store-1",
          {
            beanId: "bean-1",
            grind: "whole",
            quantity: 1,
            pickupDate,
            note: "",
          },
          { db, skipPush: true },
        ),
      ),
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 4);
    for (const item of rejected) {
      assert.ok(item.reason instanceof BeanReservationError);
      assert.equal(item.reason.status, 409);
    }

    const count = await db.collection("bean_reservations").countDocuments({
      userId: "customer-1",
      beanId: "bean-1",
      pickupDate,
      status: "REQUESTED",
    });
    assert.equal(count, 1);
  });

  it("사장·직원 본인 예약의 상태 처리는 403, 본인 취소는 허용, rejectReason 100자 초과는 400", async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const pickupDate = toKstDateKey(tomorrow);

    const staffResv = await createBeanReservation(
      "staff-1",
      "store-1",
      {
        beanId: "bean-1",
        grind: "whole",
        quantity: 1,
        pickupDate,
        note: "",
      },
      { db, skipPush: true },
    );

    await assert.rejects(
      () =>
        transitionBeanReservation(
          {
            actorUserId: "staff-1",
            reservationId: staffResv.id,
            nextStatus: "CONFIRMED",
          },
          { db, skipPush: true },
        ),
      (err: unknown) =>
        err instanceof BeanReservationError && err.status === 403,
    );

    // 고객 본인 취소는 허용
    const cancelled = await transitionBeanReservation(
      {
        actorUserId: "staff-1",
        reservationId: staffResv.id,
        nextStatus: "CANCELLED",
      },
      { db, skipPush: true },
    );
    assert.equal(cancelled.status, "CANCELLED");

    // rejectReason 100자 초과 400
    const customerResv = await createBeanReservation(
      "customer-1",
      "store-1",
      {
        beanId: "bean-1",
        grind: "drip",
        quantity: 1,
        pickupDate,
        note: "",
      },
      { db, skipPush: true },
    );

    await assert.rejects(
      () =>
        transitionBeanReservation(
          {
            actorUserId: "owner-1",
            reservationId: customerResv.id,
            nextStatus: "REJECTED",
            rejectReason: "가".repeat(101),
          },
          { db, skipPush: true },
        ),
      (err: unknown) =>
        err instanceof BeanReservationError && err.status === 400,
    );
  });
});
