"use client";
import { CheckCircle2 } from "lucide-react";
import type { UserCoupon } from "@/domain/showroom/types";
import { Button } from "@/ui/shared/Button";
export function CouponReceipt({
  coupon,
  staff = false,
  onClose,
}: {
  coupon: UserCoupon;
  staff?: boolean;
  onClose: () => void;
}) {
  return (
    <section aria-label="쿠폰 사용 완료" className="space-y-5 px-6 py-8">
      <CheckCircle2
        size={40}
        className="text-[var(--success)]"
        aria-hidden="true"
      />
      <h2 className="ds-display-m">
        {staff ? "쿠폰 적용 완료" : "쿠폰을 사용했어요"}
      </h2>
      <p className="ds-h2">{coupon.coupon?.discountDetail}</p>
      <p className="ds-body">
        {coupon.usedAtStoreName} · {coupon.coupon?.title}
      </p>
      {staff ? (
        <p className="ds-h3">위 혜택을 POS에 반영해 주세요.</p>
      ) : (
        <p className="ds-body">
          직원 확인이 완료됐어요. 할인이 적용됐는지 확인해 주세요.
        </p>
      )}
      <dl className="ds-body-s space-y-3 border-y border-[var(--border-strong)] py-5">
        <div>
          <dt>사용 일시</dt>
          <dd>
            {coupon.usedAt
              ? new Date(coupon.usedAt).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })
              : ""}
          </dd>
        </div>
        <div>
          <dt>사용 번호</dt>
          <dd className="break-all">{coupon.usageLogId}</dd>
        </div>
      </dl>
      <p className="ds-body-s text-[var(--fg-muted)]">
        쿠폰 사용 내역이며 결제 영수증은 아닙니다.
      </p>
      <Button onClick={onClose}>
        {staff ? "다음 고객 스캔" : "쿠폰함으로"}
      </Button>
    </section>
  );
}
