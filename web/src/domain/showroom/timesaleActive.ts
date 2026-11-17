import { canIssueCoupon } from "./couponPolicy";
import type { ShowroomCoupon } from "./types";

export function isActiveTimesaleCoupon(
  coupon: ShowroomCoupon,
  now = new Date(),
): boolean {
  if (coupon.couponType !== "timesale") return false;
  return canIssueCoupon(coupon, now);
}

export function selectActiveTimesaleCoupons(
  coupons: ShowroomCoupon[],
  now = new Date(),
): ShowroomCoupon[] {
  return coupons.filter((coupon) => isActiveTimesaleCoupon(coupon, now));
}
