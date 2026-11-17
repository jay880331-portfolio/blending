"use client";
import { useEffect, useRef, useState } from "react";
import type { UserCoupon } from "@/domain/showroom/types";
import { customerQrValue } from "@/domain/showroom/customerQr";
import { QrCode } from "@/ui/shared/QrCode";
import { Button } from "@/ui/shared/Button";
import { CouponTerms } from "./CouponTerms";

import { readCouponResponse as couponJson } from "@/adapters/http/showroomApi";

export function CouponPresentation({
  coupon,
  onUsed,
  onClose,
}: {
  coupon: UserCoupon;
  onUsed: (wallet: UserCoupon) => void;
  onClose: () => void;
}) {
  const [presentation, setPresentation] = useState<{
    token: string;
    expiresAt: string;
  } | null>(null);
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState("");
  const callback = useRef(onUsed);
  useEffect(() => {
    callback.current = onUsed;
  }, [onUsed]);
  useEffect(() => {
    let canceled = false,
      busy = false,
      token = "",
      expires = 0,
      used = false;
    const path = `/api/showroom/user-coupons/${encodeURIComponent(coupon.id)}/presentation`;
    const tick = async () => {
      if (busy || canceled) return;
      busy = true;
      try {
        const status = await couponJson<{ userCoupon: UserCoupon }>(
          await fetch(path, { cache: "no-store" }),
        );
        if (canceled) return;
        if (status.userCoupon.status === "USED") {
          used = true;
          callback.current({ ...coupon, ...status.userCoupon });
          return;
        }
        if (Date.now() >= expires) {
          const next = await couponJson<{ token: string; expiresAt: string }>(
            await fetch(path, { method: "POST" }),
          );
          token = next.token;
          expires = Date.parse(next.expiresAt);
          if (canceled) {
            void fetch(path, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
              keepalive: true,
            }).catch(() => {});
            return;
          }
          setPresentation(next);
        }
        setError("");
      } catch (failure) {
        if (!canceled)
          setError(
            failure instanceof Error
              ? failure.message
              : "연결을 확인해 주세요.",
          );
      } finally {
        busy = false;
      }
    };
    void tick();
    // ponytail: QR 표시 중에만 2초 조회. 동시 이용량 증가 시 SSE로 교체.
    const poll = window.setInterval(() => void tick(), 2000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      canceled = true;
      window.clearInterval(poll);
      window.clearInterval(clock);
      if (token && !used)
        void fetch(path, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          keepalive: true,
        }).catch(() => {});
    };
  }, [coupon]);
  const remaining = presentation
    ? Math.max(0, Math.ceil((Date.parse(presentation.expiresAt) - now) / 1000))
    : 0;
  return (
    <section
      aria-label="직원에게 보여줄 쿠폰 QR"
      className="space-y-5 px-6 py-8"
    >
      <p className="ds-label text-[var(--fg-muted)]">
        직원이 스캔하면 양쪽 화면에 사용 결과가 표시돼요
      </p>
      <h2 className="ds-display-m">직원에게 보여주세요</h2>
      <p className="ds-h2">{coupon.coupon?.discountDetail}</p>
      <p className="ds-body">{coupon.coupon?.title}</p>
      <div className="flex min-h-64 items-center justify-center border-y border-[var(--border-strong)] py-6">
        {presentation && remaining > 0 ? (
          <QrCode
            value={customerQrValue(presentation.token)}
            label="직원 스캔용 일회용 쿠폰 QR"
            size={240}
          />
        ) : (
          <p role="status">QR을 준비하고 있어요…</p>
        )}
      </div>
      <p role="status" className="ds-body-s text-[var(--fg-muted)]">
        {remaining > 0
          ? `${remaining}초 후 새 QR로 바뀝니다. 직원 확인 전에는 사용되지 않아요.`
          : "인터넷 연결 후 새 QR을 표시합니다."}
      </p>
      {coupon.coupon ? <CouponTerms coupon={coupon.coupon} /> : null}
      {error ? (
        <p role="alert" className="ds-body text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      <Button variant="secondary" onClick={onClose}>
        닫기
      </Button>
    </section>
  );
}
