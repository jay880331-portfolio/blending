import type { ShowroomCoupon } from "@/domain/showroom/types";
import { couponConditions } from "@/domain/showroom/couponPolicy";

export function CouponTerms({ coupon }: { coupon: ShowroomCoupon }) {
  const conditions = couponConditions(coupon);
  return conditions.length ? (
    <ul
      className="ds-body-s mt-3 space-y-1 text-[var(--fg-muted)]"
      aria-label="쿠폰 사용 조건"
    >
      {conditions.map((condition, index) => (
        <li key={index}>{condition}</li>
      ))}
    </ul>
  ) : null;
}
