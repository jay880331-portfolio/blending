"use client";
import { useEffect, useState } from "react";
import type { BaristaShowroom, ShowroomCoupon } from "@/domain/showroom/types";
import { canIssueCoupon } from "@/domain/showroom/couponPolicy";
import { couponUsageScopeLabel } from "@/domain/showroom/couponStatus";
import {
  fetchMyShowroom,
  fetchShowrooms,
  joinPlatformCoupons,
  removeCoupon,
} from "@/adapters/http/showroomApi";
import { Button } from "@/ui/shared/Button";
import { ConfirmDialog } from "@/ui/shared/ConfirmDialog";
import { CouponCreateForm } from "./CouponCreateForm";
import { CouponTerms } from "./CouponTerms";
import { CouponPushComposer } from "./CouponPushComposer";

export function CouponManager({ showroom }: { showroom: BaristaShowroom }) {
  const [coupons, setCoupons] = useState<ShowroomCoupon[]>([]);
  const [stores, setStores] = useState<BaristaShowroom[]>([showroom]);
  const [creating, setCreating] = useState(false);
  const [pushId, setPushId] = useState<string | null>(null);
  const [joined, setJoined] = useState(
    Boolean(showroom.platformCouponsAcceptedAt),
  );
  const [confirmJoin, setConfirmJoin] = useState(false);
  const [stop, setStop] = useState<ShowroomCoupon | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const load = async () => {
    const [mine, all] = await Promise.all([
      fetchMyShowroom(),
      fetchShowrooms(),
    ]);
    setCoupons(mine.coupons);
    setStores(all);
  };
  useEffect(() => {
    let canceled = false;
    Promise.all([fetchMyShowroom(), fetchShowrooms()])
      .then(([mine, all]) => {
        if (!canceled) {
          setCoupons(mine.coupons);
          setStores(all);
        }
      })
      .catch(() => {
        if (!canceled)
          setError("쿠폰 정보를 불러오지 못했습니다. 새로고침해 주세요.");
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, []);
  const act = async (action: () => Promise<unknown>) => {
    setError("");
    try {
      await action();
      await load();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "요청을 처리하지 못했습니다.",
      );
      throw failure;
    }
  };
  return (
    <section className="mt-6 px-5" aria-label="쿠폰 관리">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="ds-h2">우리 매장 쿠폰</h2>
          <p className="ds-body-s mt-1 text-[var(--fg-muted)]">
            혜택과 기간을 정하고, 미리 본 뒤 등록하세요.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={loading}
          onClick={() => setCreating(true)}
        >
          쿠폰 만들기
        </Button>
      </div>
      <div className="mt-5 border-y border-[var(--border-strong)] py-4">
        <h3 className="ds-h3">전국 공용 쿠폰 참여</h3>
        <p className="ds-body-s mt-2 text-[var(--fg-muted)]">
          {joined
            ? "운영자가 승인한 전국 공용 쿠폰을 우리 매장에서 사용할 수 있어요."
            : "전국 공용 쿠폰은 참여에 동의한 매장에서만 사용할 수 있어요. 참여 전 비용 부담과 운영 방식을 확인해 주세요."}
        </p>
        {!joined ? (
          <Button
            variant="ghost"
            className="mt-3"
            onClick={() => setConfirmJoin(true)}
          >
            참여 내용 확인
          </Button>
        ) : null}
      </div>
      {creating ? (
        <CouponCreateForm
          showroom={showroom}
          stores={stores}
          onCancel={() => setCreating(false)}
          onCreated={(coupon) => {
            setCoupons((current) => [coupon, ...current]);
            setCreating(false);
          }}
        />
      ) : null}
      {error ? (
        <p role="alert" className="ds-body mt-4 text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p role="status" className="ds-body mt-5">
          쿠폰을 불러오는 중…
        </p>
      ) : !coupons.length ? (
        <p className="ds-body mt-6 text-[var(--fg-muted)]">
          등록된 쿠폰이 없습니다.
        </p>
      ) : (
        <div className="mt-5">
          {coupons.map((coupon) => (
            <article
              key={coupon.id}
              className="border-b border-[var(--border-strong)] py-5"
            >
              <p className="ds-label text-[var(--fg-muted)]">
                {coupon.couponType === "timesale" ? "타임세일" : "일반"} ·{" "}
                {couponUsageScopeLabel(coupon.usageScope)} ·{" "}
                {coupon.issuanceStoppedAt
                  ? "추가 발급 중단"
                  : coupon.approvalState === "PENDING"
                    ? "참여 승인 대기"
                    : coupon.approvalState === "REJECTED"
                      ? "참여 거절"
                      : Date.parse(coupon.validUntil) <= now.getTime()
                        ? "기간 종료"
                        : coupon.validFrom &&
                            Date.parse(coupon.validFrom) > now.getTime()
                          ? "시작 예정"
                          : "공개 중"}
              </p>
              <h3 className="ds-h2 mt-3">{coupon.title}</h3>
              <p className="ds-body mt-2">{coupon.discountDetail}</p>
              <CouponTerms coupon={coupon} />
              <p className="ds-body-s mt-3 text-[var(--fg-muted)]">
                {new Date(coupon.validUntil).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })}
                까지 · 발급 {coupon.issuedCount ?? 0} /{" "}
                {coupon.totalLimit ?? "무제한"} · 고객당{" "}
                {coupon.perUserLimit ?? 1}장
              </p>
              {coupon.approvals?.map((approval) => (
                <p
                  className="ds-body-s mt-1 text-[var(--fg-muted)]"
                  key={approval.storeId}
                >
                  {approval.storeName}:{" "}
                  {approval.status === "APPROVED"
                    ? "동의 완료"
                    : approval.status === "REJECTED"
                      ? "거절"
                      : "동의 대기"}
                </p>
              ))}
              <div className="mt-4 flex gap-3">
                {!coupon.issuanceStoppedAt ? (
                  <Button variant="ghost" onClick={() => setStop(coupon)}>
                    추가 발급 중단
                  </Button>
                ) : null}
                {coupon.couponType === "timesale" ? (
                  <Button
                    variant="secondary"
                    disabled={!canIssueCoupon(coupon, now)}
                    onClick={() =>
                      setPushId(pushId === coupon.id ? null : coupon.id)
                    }
                  >
                    알림 편집·발송
                  </Button>
                ) : null}
              </div>
              {pushId === coupon.id ? (
                <CouponPushComposer
                  coupon={coupon}
                  onClose={() => setPushId(null)}
                  onSent={() => {
                    void load().catch(() =>
                      setError("목록을 새로고침해 주세요."),
                    );
                  }}
                />
              ) : null}
            </article>
          ))}
        </div>
      )}
      {confirmJoin ? (
        <ConfirmDialog
          title="전국 공용 쿠폰에 참여할까요?"
          description="운영자가 승인한 공용 쿠폰을 우리 매장에서 받습니다. 비용은 발행 매장 부담으로 기록하며 자동 정산·송금은 없습니다. 실제 비용 정산 조건은 발행 매장 및 운영자와 확인해 주세요. 참여 철회는 운영자에게 요청하며, 이미 발급된 쿠폰의 사용 조건은 유지합니다."
          confirmText="참여 동의"
          errorMessage="참여를 저장하지 못했습니다."
          onCancel={() => setConfirmJoin(false)}
          onConfirm={async () => {
            await joinPlatformCoupons();
            setJoined(true);
          }}
        />
      ) : null}
      {stop ? (
        <ConfirmDialog
          title="추가 발급을 중단할까요?"
          description="새로운 쿠폰 발급만 중단합니다. 이미 고객이 받은 쿠폰은 기존 기간과 조건으로 계속 사용할 수 있습니다."
          confirmText="발급 중단"
          errorMessage="중단하지 못했습니다."
          onCancel={() => setStop(null)}
          onConfirm={() => act(() => removeCoupon(stop.id))}
        />
      ) : null}
    </section>
  );
}
