import { MongoServerError, type Db } from "mongodb";

export async function ensureCouponClaimIndexes(db: Db) {
  const coupons = db.collection("user_coupons");
  // 누락된 requestId는 null로 취급되어 기존 쿠폰의 고객당 1장 제약도 유지한다.
  await coupons.createIndex(
    { userId: 1, couponId: 1, claimRequestId: 1 },
    { unique: true, name: "user_coupons_claim_request" },
  );
  try {
    await coupons.dropIndex("user_coupons_user_coupon");
  } catch (error) {
    if (!(error instanceof MongoServerError && error.code === 27)) throw error;
  }
}
