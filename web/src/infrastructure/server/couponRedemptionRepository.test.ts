import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { MongoClient, type Db } from "mongodb";
import {
  redeemCouponAtStore,
  verifyStoreQr,
} from "./couponRedemptionRepository";
import type { ShowroomCoupon, UserCoupon } from "@/domain/showroom/types";

// 독립된 로컬 replica set 전용. 운영 DB에는 접속하지 않는다.
const uri = process.env.COUPON_TEST_MONGODB_URI;
describe("QR 쿠폰 사용 MongoDB 트랜잭션", { skip: !uri }, () => {
  let client: MongoClient;
  let db: Db;
  const qr = { storeId: "busan", code: "a".repeat(43) };
  const definition: ShowroomCoupon = {
    id: "coupon",
    baristaId: "owner-seoul",
    showroomId: "seoul",
    title: "전국 커피 산책",
    discountDetail: "1,000원 할인",
    usageScope: "ALL",
    couponType: "regular",
    validUntil: "2099-01-01T00:00:00Z",
    createdAt: "",
    updatedAt: "",
  };
  const issued: UserCoupon = {
    id: "wallet",
    userId: "customer",
    couponId: "coupon",
    status: "ISSUED",
    createdAt: "",
    updatedAt: "",
  };
  before(async () => {
    assert.match(uri!, /^mongodb:\/\/(127\.0\.0\.1|localhost):/);
    client = await MongoClient.connect(uri!);
    db = client.db(`coupon_qr_test_${process.pid}_${Date.now()}`);
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
        "store_qr_codes",
        "coupons",
        "user_coupons",
        "coupon_usage_logs",
      ].map((name) => db.collection(name).deleteMany({})),
    );
    await db.collection("users").insertOne({
      id: "owner-busan",
      role: "barista",
      accountStatus: "active",
    });
    await db.collection("barista_showrooms").insertOne({
      id: "busan",
      userId: "owner-busan",
      storeName: "부산 파도 커피",
    });
    await db
      .collection<{ _id: string; code: string }>("store_qr_codes")
      .insertOne({ _id: qr.storeId, code: qr.code });
    await db.collection<ShowroomCoupon>("coupons").insertOne({ ...definition });
    await db.collection<UserCoupon>("user_coupons").insertOne({ ...issued });
  });
  const redeem = (userId = "customer", code = qr) =>
    redeemCouponAtStore(userId, "wallet", code, {
      db,
      client,
      joinedStoreIds: [],
    });
  it("연속·동시 요청에서도 한 번만 사용하고 실제 부산 매장을 기록한다", async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () => redeem()),
    );
    assert.equal(results.filter((result) => result.newlyUsed).length, 1);
    assert.equal(await db.collection("coupon_usage_logs").countDocuments(), 1);
    const log = await db
      .collection("coupon_usage_logs")
      .findOne({ userCouponId: "wallet" });
    assert.equal(log?.issuerStoreId, "seoul");
    assert.equal(log?.storeId, "busan");
    assert.equal((await redeem()).userCoupon.usedAtStoreName, "부산 파도 커피");
  });
  it("타인 쿠폰·위조 QR·사용처 불일치는 차감하지 않는다", async () => {
    await assert.rejects(() => redeem("attacker"));
    await assert.rejects(() =>
      redeem("customer", { ...qr, code: "b".repeat(43) }),
    );
    for (const scope of ["SINGLE", "GROUP"] as const) {
      await db.collection("coupons").updateOne(
        { id: "coupon" },
        {
          $set: {
            usageScope: scope,
            storeId: "seoul",
            allowedStoreIds: ["seoul"],
          },
        },
      );
      await assert.rejects(() => redeem(), /사용할 수 없는 쿠폰/);
    }
    assert.equal(
      (await db.collection("user_coupons").findOne({ id: "wallet" }))?.status,
      "ISSUED",
    );
    assert.equal(await db.collection("coupon_usage_logs").countDocuments(), 0);
  });
  it("허용된 연합 매장은 고객 단골 가입 없이 사용할 수 있다", async () => {
    await db
      .collection("coupons")
      .updateOne(
        { id: "coupon" },
        { $set: { usageScope: "GROUP", allowedStoreIds: ["seoul", "busan"] } },
      );
    assert.equal((await redeem()).userCoupon.status, "USED");
  });
  it("만료·삭제 쿠폰과 비활성 매장을 거절한다", async () => {
    await db
      .collection("coupons")
      .updateOne({ id: "coupon" }, { $set: { validUntil: "2000-01-01" } });
    await assert.rejects(() => redeem(), /기한/);
    await db.collection("coupons").deleteMany({});
    await assert.rejects(() => redeem(), /종료/);
    await db
      .collection("users")
      .updateOne(
        { id: "owner-busan" },
        { $set: { accountStatus: "suspended" } },
      );
    await assert.rejects(() => verifyStoreQr(qr, db), /사용할 수 없는 매장/);
  });
  it("원장 저장 실패 시 쿠폰 차감도 롤백한다", async () => {
    await db
      .collection<{ _id: string }>("coupon_usage_logs")
      .insertOne({ _id: "qr_wallet" });
    await assert.rejects(() => redeem());
    assert.equal(
      (await db.collection("user_coupons").findOne({ id: "wallet" }))?.status,
      "ISSUED",
    );
  });
});
