"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ticket } from "lucide-react";
import type { UserCoupon } from "@/domain/showroom/types";
import { fetchUserCoupons } from "@/adapters/http/showroomApi";
import { CouponPresentation } from "./CouponPresentation";
import { CouponReceipt } from "./CouponReceipt";
import {
  couponUsageScopeLabel,
  resolveUserCouponStatus,
  userCouponListPlacement,
} from "@/domain/showroom/couponStatus";
import { ShowroomHeader } from "./ShowroomHeader";
import { EmptyState } from "@/ui/shared/EmptyState";
import { BottomNav } from "@/ui/shared/BottomNav";
import { Button } from "@/ui/shared/Button";
import { TextTabBar } from "@/ui/shared/TextTabBar";
import { CouponTerms } from "./CouponTerms";

function usedTime(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function UserCouponsApp() {
  const [coupons, setCoupons] = useState<UserCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"available" | "history">("available");
  const [selected, setSelected] = useState<UserCoupon | null>(null);
  const [receipt, setReceipt] = useState<UserCoupon | null>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let canceled = false;
    void fetchUserCoupons()
      .then((data) => {
        if (!canceled) setCoupons(data.userCoupons);
      })
      .catch(() => {
        if (!canceled)
          setError("쿠폰함을 불러오지 못했습니다. 새로고침해 주세요.");
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      canceled = true;
      window.clearInterval(clock);
    };
  }, []);
  const available = coupons.filter(
    (coupon) =>
      userCouponListPlacement(
        coupon.status,
        coupon.coupon?.validUntil,
        coupon.approvalExpiresAt,
        now,
      ) === "available",
  );
  const history = coupons.filter((coupon) => !available.includes(coupon));

  return (
    <main className="min-h-screen bg-[var(--bg)] pb-32 text-[var(--fg)]">
      <ShowroomHeader
        title="내 쿠폰함"
        backHref="/mypage"
        showCouponLink={false}
      />
      {selected ? (
        <CouponPresentation
          coupon={selected}
          onClose={() => setSelected(null)}
          onUsed={(wallet) => {
            setCoupons((current) =>
              current.map((item) => (item.id === wallet.id ? wallet : item)),
            );
            setSelected(null);
            setReceipt(wallet);
          }}
        />
      ) : receipt ? (
        <CouponReceipt
          coupon={receipt}
          onClose={() => {
            setReceipt(null);
            setTab("history");
          }}
        />
      ) : (
        <>
          <section className="px-6 pb-8 pt-6">
            <p className="ds-label text-[var(--fg-muted)]">
              카운터에서 간편하게
            </p>
            <h1 className="ds-display-m mt-2">
              쿠폰을 고르고
              <br />
              직원에게 보여주세요
            </h1>
            <p className="ds-body mt-3 text-[var(--fg-muted)]">
              직원이 QR을 스캔하고 확인하면 양쪽 화면에 사용 결과가 표시돼요.
            </p>
            {error ? (
              <p role="alert" className="ds-body mt-4 text-[var(--danger)]">
                {error}
              </p>
            ) : null}
          </section>
          <TextTabBar
            ariaLabel="쿠폰함 탭"
            activeValue={tab}
            items={[
              {
                value: "available",
                label: "사용 가능",
                count: available.length,
              },
              { value: "history", label: "사용 내역", count: history.length },
            ]}
            onChange={setTab}
          />
          <section
            aria-label={tab === "available" ? "보유 쿠폰" : "쿠폰 사용 내역"}
            className="px-6"
          >
            {loading ? (
              <p
                role="status"
                className="ds-body py-12 text-center text-[var(--fg-muted)]"
              >
                쿠폰함을 확인하고 있어요…
              </p>
            ) : (tab === "available" ? available : history).length === 0 ? (
              <EmptyState
                title={
                  tab === "available"
                    ? "담아둔 쿠폰이 없어요"
                    : "아직 사용 내역이 없어요"
                }
                description="바리스타 쇼룸에서 마음에 드는 혜택을 만나보세요."
              />
            ) : (
              (tab === "available" ? available : history).map((userCoupon) => {
                const coupon = userCoupon.coupon;
                const status = resolveUserCouponStatus(
                  userCoupon.status,
                  coupon?.validUntil,
                  now,
                  userCoupon.approvalExpiresAt,
                );
                return (
                  <article
                    key={userCoupon.id}
                    className="border-b border-[var(--border)] py-6"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="ds-label text-[var(--fg-muted)]">
                        {couponUsageScopeLabel(coupon?.usageScope)}
                      </p>
                      <Ticket
                        size={18}
                        aria-hidden="true"
                        className="text-[var(--fg-muted)]"
                      />
                    </div>
                    <h2 className="ds-h2 mt-3">
                      {coupon?.title || "디지털 쿠폰"}
                    </h2>
                    <p className="ds-body mt-2 text-[var(--accent)]">
                      {coupon?.discountDetail}
                    </p>
                    {coupon ? <CouponTerms coupon={coupon} /> : null}
                    {userCoupon.showroom ? (
                      <Link
                        className="ds-body-s mt-3 inline-block text-[var(--fg-muted)] underline"
                        href={`/showroom/${userCoupon.showroom.id}`}
                      >
                        {userCoupon.showroom.storeName} 발행
                      </Link>
                    ) : null}
                    <p className="ds-label mt-3 text-[var(--fg-muted)]">
                      {coupon
                        ? `${usedTime(coupon.validUntil)}까지`
                        : "종료된 쿠폰"}
                    </p>
                    {tab === "available" ? (
                      <>
                        <p className="ds-body-s mt-4 text-[var(--fg-muted)]">
                          {coupon?.validFrom &&
                          Date.parse(coupon.validFrom) > now.getTime()
                            ? `${usedTime(coupon.validFrom)}부터 사용 가능`
                            : "직원 확인 전에는 사용되지 않아요"}
                        </p>
                        <Button
                          variant="secondary"
                          className="mt-3"
                          disabled={
                            !coupon ||
                            Boolean(
                              coupon.validFrom &&
                              Date.parse(coupon.validFrom) > now.getTime(),
                            )
                          }
                          onClick={() => setSelected(userCoupon)}
                        >
                          직원에게 보여주기
                        </Button>
                      </>
                    ) : (
                      <div className="ds-body-s mt-4 text-[var(--fg-muted)]">
                        {status === "USED" ? (
                          <>
                            <p>
                              {userCoupon.usedAtStoreName
                                ? `${userCoupon.usedAtStoreName} · `
                                : ""}
                              사용 완료
                            </p>
                            {userCoupon.usedAt ? (
                              <p className="mt-1">
                                {usedTime(userCoupon.usedAt)}
                              </p>
                            ) : null}
                          </>
                        ) : (
                          "유효기간 만료"
                        )}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </section>
        </>
      )}
      <BottomNav active="mypage" />
    </main>
  );
}
