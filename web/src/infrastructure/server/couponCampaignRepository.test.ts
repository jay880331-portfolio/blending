import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { MongoClient, type Db } from "mongodb";
import { parseCouponDraft } from "@/domain/showroom/couponPolicy";
import type {
  BaristaShowroom,
  ShowroomCoupon,
  UserCoupon,
} from "@/domain/showroom/types";
import {
  createCouponCampaign,
  claimCouponCampaign,
  decideCouponCampaign,
  listCouponApprovals,
} from "./couponCampaignRepository";
import { redeemCouponAtStore } from "./couponRedemptionRepository";
import { couponAllowsStore } from "@/domain/showroom/storeQr";
import { ensureCouponClaimIndexes } from "@/infrastructure/mongodb/couponIndexes";

const uri = process.env.COUPON_TEST_MONGODB_URI;
describe("커스텀 쿠폰 승인·발급 트랜잭션", { skip: !uri }, () => {
  let client: MongoClient;
  let db: Db;
  const issuer: BaristaShowroom = {
    id: "seoul",
    userId: "owner-seoul",
    storeName: "서울 커피",
    bioMessage: "",
    createdAt: "",
    updatedAt: "",
  };
  const qr = { storeId: "busan", code: "b".repeat(43) };
  const draft = () =>
    parseCouponDraft({
      title: "커피 산책",
      couponType: "regular",
      usageScope: "SINGLE",
      storeId: "seoul",
      benefit: { kind: "AMOUNT", value: 1000 },
      validFrom: "2020-01-01",
      validUntil: "2099-01-01",
      totalLimit: 3,
      perUserLimit: 1,
      allowStacking: false,
      costBearer: "ISSUER",
    });
  before(async () => {
    assert.match(uri!, /^mongodb:\/\/(localhost|127\.0\.0\.1):/);
    client = await MongoClient.connect(uri!);
    db = client.db(`coupon_campaign_test_${process.pid}_${Date.now()}`);
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
        "coupons",
        "user_coupons",
        "store_qr_codes",
        "coupon_usage_logs",
      ].map((name) => db.collection(name).deleteMany({})),
    );
    await db.collection("users").insertMany([
      { id: "owner-seoul", role: "barista", accountStatus: "active" },
      { id: "owner-busan", role: "barista", accountStatus: "active" },
    ]);
    await db.collection<BaristaShowroom>("barista_showrooms").insertMany([
      { ...issuer },
      {
        ...issuer,
        id: "busan",
        userId: "owner-busan",
        storeName: "부산 커피",
        platformCouponsAcceptedAt: "2020-01-01",
      },
    ]);
    await db
      .collection("user_coupons")
      .createIndex(
        { userId: 1, couponId: 1 },
        { unique: true, name: "user_coupons_user_coupon" },
      );
    await ensureCouponClaimIndexes(db);
    await db
      .collection<{ _id: string; code: string }>("store_qr_codes")
      .insertOne({ _id: qr.storeId, code: qr.code });
  });
  const resources = () => ({ db, client });
  it("타 매장 쿠폰은 동의 전 발급 불가, 해당 점주 동의 후 공개", async () => {
    const coupon = await createCouponCampaign(
      { ...draft(), usageScope: "GROUP", allowedStoreIds: ["seoul", "busan"] },
      issuer,
      db,
    );
    assert.equal(coupon.approvalState, "PENDING");
    await assert.rejects(
      () => claimCouponCampaign("customer", coupon.id, "request", resources()),
      /대기/,
    );
    assert.equal(
      (await listCouponApprovals("owner-busan", "barista", db)).length,
      1,
    );
    await assert.rejects(
      () =>
        decideCouponCampaign(
          "attacker",
          "barista",
          coupon.id,
          "busan",
          true,
          resources(),
        ),
      /권한/,
    );
    const approved = await decideCouponCampaign(
      "owner-busan",
      "barista",
      coupon.id,
      "busan",
      true,
      resources(),
    );
    assert.equal(approved!.approvalState, "ACTIVE");
    assert.equal(
      (await claimCouponCampaign("customer", coupon.id, "request", resources()))
        .status,
      "ISSUED",
    );
  });
  it("전국 공용은 운영자 승인과 사용 매장 참여 동의가 필요하다", async () => {
    const coupon = await createCouponCampaign(
      { ...draft(), usageScope: "ALL" },
      issuer,
      db,
    );
    await assert.rejects(
      () =>
        decideCouponCampaign(
          "owner-seoul",
          "barista",
          coupon.id,
          "platform",
          true,
          resources(),
        ),
      /권한/,
    );
    const approved = await decideCouponCampaign(
      "admin",
      "admin",
      coupon.id,
      "platform",
      true,
      resources(),
    );
    assert.equal(couponAllowsStore(approved!, "busan", [], true), true);
    assert.equal(couponAllowsStore(approved!, "seoul", [], false), false);
    const wallet = await claimCouponCampaign(
      "customer",
      coupon.id,
      "request",
      resources(),
    );
    const used = await redeemCouponAtStore(
      "customer",
      wallet.id,
      qr,
      resources(),
    );
    assert.equal(used.userCoupon.status, "USED");
  });
  it("동시 발급이 총 수량을 넘지 않고 발급 수와 원장이 일치한다", async () => {
    const coupon = await createCouponCampaign(draft(), issuer, db);
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, index) =>
        claimCouponCampaign(
          `customer-${index}`,
          coupon.id,
          `request-${index}`,
          resources(),
        ),
      ),
    );
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      3,
    );
    assert.equal(await db.collection("user_coupons").countDocuments(), 3);
    assert.equal(
      (await db.collection("coupons").findOne({ id: coupon.id }))?.issuedCount,
      3,
    );
  });
  it("요청 재시도는 동일 쿠폰, 다른 요청은 고객 한도를 지킨다", async () => {
    const coupon = await createCouponCampaign(
      { ...draft(), totalLimit: 10, perUserLimit: 2 },
      issuer,
      db,
    );
    const repeated = await Promise.all(
      Array.from({ length: 5 }, () =>
        claimCouponCampaign("customer", coupon.id, "same-request", resources()),
      ),
    );
    assert.equal(new Set(repeated.map((wallet) => wallet.id)).size, 1);
    const next = await Promise.allSettled(
      Array.from({ length: 5 }, (_, index) =>
        claimCouponCampaign(
          "customer",
          coupon.id,
          `next-${index}`,
          resources(),
        ),
      ),
    );
    assert.equal(
      next.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(await db.collection("user_coupons").countDocuments(), 2);
  });
  it("추가 발급 중단과 원본 변경 후에도 발급 당시 혜택·사용처·비용을 유지한다", async () => {
    const coupon = await createCouponCampaign(
      { ...draft(), usageScope: "SINGLE", storeId: "busan" },
      issuer,
      db,
    );
    await decideCouponCampaign(
      "owner-busan",
      "barista",
      coupon.id,
      "busan",
      true,
      resources(),
    );
    const wallet = await claimCouponCampaign(
      "customer",
      coupon.id,
      "request",
      resources(),
    );
    await db.collection<ShowroomCoupon>("coupons").updateOne(
      { id: coupon.id },
      {
        $set: {
          issuanceStoppedAt: new Date().toISOString(),
          discountDetail: "변경",
          storeId: "seoul",
          validUntil: "2000-01-01",
        },
      },
    );
    await assert.rejects(() =>
      claimCouponCampaign("another", coupon.id, "request", resources()),
    );
    const used = await redeemCouponAtStore(
      "customer",
      wallet.id,
      qr,
      resources(),
    );
    assert.equal(used.userCoupon.status, "USED");
    const log = await db
      .collection("coupon_usage_logs")
      .findOne({ userCouponId: wallet.id });
    assert.equal(log?.discountDetail, "1,000원 할인");
    assert.equal(log?.costBearer, "ISSUER");
    assert.equal(log?.storeId, "busan");
  });
  it("참여 거절은 공개하지 않고, 이전 점주가 승인할 수 없다", async () => {
    const coupon = await createCouponCampaign(
      { ...draft(), usageScope: "SINGLE", storeId: "busan" },
      issuer,
      db,
    );
    await db
      .collection("barista_showrooms")
      .updateOne({ id: "busan" }, { $set: { userId: "new-owner" } });
    await assert.rejects(
      () =>
        decideCouponCampaign(
          "owner-busan",
          "barista",
          coupon.id,
          "busan",
          true,
          resources(),
        ),
      /현재 매장 점주/,
    );
    await db
      .collection("barista_showrooms")
      .updateOne({ id: "busan" }, { $set: { userId: "owner-busan" } });
    assert.equal(
      (await decideCouponCampaign(
        "owner-busan",
        "barista",
        coupon.id,
        "busan",
        false,
        resources(),
      ))!.approvalState,
      "REJECTED",
    );
    await assert.rejects(() =>
      claimCouponCampaign("customer", coupon.id, "request", resources()),
    );
    assert.equal(
      await db.collection<UserCoupon>("user_coupons").countDocuments(),
      0,
    );
  });
});
