import assert from "node:assert/strict";
import { before, after, beforeEach, describe, it } from "node:test";
import { MongoClient, type Db } from "mongodb";
import {
  createCouponPresentation,
  cancelCouponPresentation,
  inspectPresentedCoupon,
  redeemPresentedCoupon,
  manageCouponStaff,
  listCouponStaffStores,
} from "./couponPresentationRepository";
import { customerQrValue, parseCustomerQr } from "@/domain/showroom/customerQr";
import type { ShowroomCoupon, UserCoupon } from "@/domain/showroom/types";

it("고객 QR은 전용 접두어와 43자 토큰만 허용한다", () => {
  const token = "a".repeat(43);
  assert.equal(parseCustomerQr(customerQrValue(token)), token);
  for (const value of [
    token,
    "https://example.com/" + token,
    customerQrValue(token) + "x",
    customerQrValue("a"),
  ])
    assert.equal(parseCustomerQr(value), null);
});
const uri = process.env.COUPON_TEST_MONGODB_URI;
describe("직원 스캔 쿠폰 트랜잭션", { skip: !uri }, () => {
  let client: MongoClient, db: Db;
  const definition: ShowroomCoupon = {
    id: "coupon",
    baristaId: "owner",
    showroomId: "store",
    title: "커피 혜택",
    discountDetail: "1,000원 할인",
    usageScope: "SINGLE",
    storeId: "store",
    couponType: "regular",
    validUntil: "2099-01-01T00:00:00Z",
    createdAt: "",
    updatedAt: "",
  };
  const wallet: UserCoupon = {
    id: "wallet",
    userId: "customer",
    couponId: "coupon",
    status: "ISSUED",
    createdAt: "",
    updatedAt: "",
  };
  const resources = () => ({ db, client });
  const issue = () =>
    createCouponPresentation("customer", "wallet", resources());
  const inspect = (token: string, actor = "owner", store = "store") =>
    inspectPresentedCoupon(actor, store, token, resources());
  const redeem = (token: string, actor = "owner", store = "store") =>
    redeemPresentedCoupon(actor, store, token, resources());
  before(async () => {
    assert.match(uri!, /^mongodb:\/\/(127\.0\.0\.1|localhost):/);
    client = await MongoClient.connect(uri!);
    db = client.db(`coupon_staff_test_${process.pid}_${Date.now()}`);
  });
  after(async () => {
    await db?.dropDatabase();
    await client?.close();
  });
  beforeEach(async () => {
    for (const name of [
      "users",
      "barista_showrooms",
      "coupons",
      "user_coupons",
      "coupon_presentations",
      "coupon_usage_logs",
      "coupon_store_staff",
    ])
      await db.collection(name).deleteMany({});
    await db.collection("users").insertMany([
      { id: "owner", role: "barista", phone: "01000000001" },
      { id: "staff", role: "barista", phone: "01000000002" },
      { id: "stranger", role: "barista", phone: "01000000003" },
      { id: "customer", role: "enthusiast", phone: "01000000004" },
    ]);
    await db.collection("barista_showrooms").insertMany([
      { id: "store", userId: "owner", storeName: "서울 커피" },
      { id: "other", userId: "stranger", storeName: "부산 커피" },
    ]);
    await db.collection<ShowroomCoupon>("coupons").insertOne({ ...definition });
    await db.collection<UserCoupon>("user_coupons").insertOne({ ...wallet });
  });
  it("타인 발급·미등록 직원·직원의 자기 쿠폰을 거부한다", async () => {
    await assert.rejects(() =>
      createCouponPresentation("stranger", "wallet", resources()),
    );
    const { token } = await issue();
    await assert.rejects(() => inspect(token, "staff"), /권한/);
    await db
      .collection("user_coupons")
      .updateOne({ id: "wallet" }, { $set: { userId: "owner" } });
    const own = await createCouponPresentation("owner", "wallet", resources());
    await assert.rejects(() => inspect(own.token), /본인의/);
  });
  it("관리자가 부여한 직원만 사용 가능하며 해제·소유자 변경은 즉시 차단한다", async () => {
    await manageCouponStaff("owner", { phone: "01000000002" }, db);
    assert.equal((await listCouponStaffStores("staff", db)).length, 1);
    const { token } = await issue();
    await inspect(token, "staff");
    await manageCouponStaff("owner", { userId: "staff", revoke: true }, db);
    await assert.rejects(() => redeem(token, "staff"), /권한/);
    await manageCouponStaff("owner", { phone: "01000000002" }, db);
    await db
      .collection("barista_showrooms")
      .updateOne({ id: "store" }, { $set: { userId: "stranger" } });
    await assert.rejects(() => inspect(token, "staff"), /권한/);
  });
  it("비활성·역할 변경 직원도 권한을 해제할 수 있다", async () => {
    await manageCouponStaff("owner", { phone: "01000000002" }, db);
    await db
      .collection("users")
      .updateOne(
        { id: "staff" },
        { $set: { role: "enthusiast", accountStatus: "suspended" } },
      );
    await manageCouponStaff("owner", { userId: "staff", revoke: true }, db);
    await db
      .collection("users")
      .updateOne(
        { id: "staff" },
        { $set: { role: "barista", accountStatus: "active" } },
      );
    const { token } = await issue();
    await assert.rejects(() => inspect(token, "staff"), /권한/);
  });
  it("갱신·취소·만료·위조 QR을 거부한다", async () => {
    const first = await issue(),
      second = await issue();
    await assert.rejects(() => inspect(first.token), /만료/);
    await cancelCouponPresentation("customer", "wallet", second.token, db);
    await assert.rejects(() => inspect(second.token), /만료/);
    const third = await issue();
    await db
      .collection("coupon_presentations")
      .updateMany({}, { $set: { expiresAt: new Date(0) } });
    await assert.rejects(() => inspect(third.token), /만료/);
    await assert.rejects(() => inspect("z".repeat(43)));
  });
  it("미리보기와 확정에서 SINGLE/GROUP/ALL 사용처·참여 정책을 검증한다", async () => {
    const { token } = await issue();
    await assert.rejects(
      () => inspect(token, "stranger", "other"),
      /사용할 수 없는/,
    );
    await db
      .collection("coupons")
      .updateOne(
        { id: "coupon" },
        { $set: { usageScope: "GROUP", allowedStoreIds: ["other"] } },
      );
    await inspect(token, "stranger", "other");
    await db.collection("coupons").updateOne(
      { id: "coupon" },
      {
        $set: {
          usageScope: "ALL",
          policyVersion: 2,
          approvalState: "ACTIVE",
        },
      },
    );
    await assert.rejects(
      () => inspect(token, "stranger", "other"),
      /사용할 수 없는/,
    );
    await db
      .collection("barista_showrooms")
      .updateOne(
        { id: "other" },
        { $set: { platformCouponsAcceptedAt: new Date().toISOString() } },
      );
    assert.equal(
      (await redeem(token, "stranger", "other")).userCoupon.usedAtStoreId,
      "other",
    );
  });
  it("동시 확인은 차감·원장 1건, 동일 직원 재시도만 동일 결과", async () => {
    await manageCouponStaff("owner", { phone: "01000000002" }, db);
    const { token } = await issue();
    const results = await Promise.allSettled([
      redeem(token),
      redeem(token, "staff"),
      redeem(token),
    ]);
    assert.equal(await db.collection("coupon_usage_logs").countDocuments(), 1);
    const log = await db
      .collection("coupon_usage_logs")
      .findOne({ userCouponId: "wallet" });
    assert.equal(log?.method, "STAFF_QR");
    assert.ok(["owner", "staff"].includes(log?.processedBy));
    assert.ok(results.some((result) => result.status === "fulfilled"));
    assert.equal((await redeem(token, log?.processedBy)).newlyUsed, false);
    await assert.rejects(
      () => redeem(token, log?.processedBy === "owner" ? "staff" : "owner"),
      /처리된/,
    );
    await assert.rejects(issue, /사용할 수 없는/);
  });
  it("원장 실패는 쿠폰과 QR 사용 상태를 함께 롤백한다", async () => {
    const { token } = await issue();
    await db
      .collection<{ _id: string }>("coupon_usage_logs")
      .insertOne({ _id: "qr_wallet" });
    await assert.rejects(() => redeem(token));
    assert.equal(
      (await db.collection("user_coupons").findOne({ id: "wallet" }))?.status,
      "ISSUED",
    );
    assert.equal(
      (
        await db
          .collection("coupon_presentations")
          .findOne({ userId: "customer" })
      )?.state,
      "OPEN",
    );
  });
  it("발급 당시 혜택을 유지하고 발급 중지 후에도 보유 쿠폰은 사용한다", async () => {
    await db.collection("user_coupons").updateOne(
      { id: "wallet" },
      {
        $set: {
          couponSnapshot: {
            ...definition,
            issuanceStoppedAt: new Date().toISOString(),
          },
        },
      },
    );
    await db.collection("coupons").deleteMany({});
    const { token } = await issue();
    assert.equal((await redeem(token)).coupon.discountDetail, "1,000원 할인");
  });
  it("QR 갱신과 확정 경쟁에서도 사용 완료 후 새 유효 QR을 만들지 않는다", async () => {
    const { token } = await issue();
    await Promise.allSettled([issue(), redeem(token)]);
    const current = await db
      .collection("user_coupons")
      .findOne({ id: "wallet" });
    if (current?.status === "USED") await assert.rejects(issue);
    else await assert.rejects(() => inspect(token), /만료/);
  });
});
