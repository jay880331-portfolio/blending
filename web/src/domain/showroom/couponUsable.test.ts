import assert from "node:assert/strict";
import { test } from "node:test";
import { isUserCouponUsable } from "./couponStatus";
import type { UserCoupon, ShowroomCoupon } from "./types";

test("홈 사용 가능 수는 사용·만료·시작 전·잘못된 기간·정의 없는 쿠폰을 제외한다", () => {
  const now = new Date("2026-10-20T00:00:00Z");
  const coupon = { validUntil: "2026-11-01T00:00:00Z" } as ShowroomCoupon;
  const wallet = { status: "ISSUED", coupon } as UserCoupon;
  assert.equal(isUserCouponUsable(wallet, now), true);
  for (const status of ["USED", "EXPIRED"] as const)
    assert.equal(isUserCouponUsable({ ...wallet, status }, now), false);
  for (const patch of [
    { validUntil: now.toISOString() },
    { validUntil: "invalid" },
    { validFrom: "2026-10-21T00:00:00Z" },
    { validFrom: "invalid" },
  ]) {
    assert.equal(
      isUserCouponUsable({ ...wallet, coupon: { ...coupon, ...patch } }, now),
      false,
    );
  }
  assert.equal(
    isUserCouponUsable({ ...wallet, coupon: undefined }, now),
    false,
  );
  assert.equal(
    isUserCouponUsable(
      { ...wallet, couponSnapshot: { ...coupon, validUntil: "2020-01-01" } },
      now,
    ),
    false,
  );
});
