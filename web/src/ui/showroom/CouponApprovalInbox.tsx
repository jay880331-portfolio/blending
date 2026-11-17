"use client";
import { useEffect, useState } from "react";
import type { BaristaShowroom, ShowroomCoupon } from "@/domain/showroom/types";
import {
  fetchCouponApprovals,
  fetchShowrooms,
  decideCouponApproval,
} from "@/adapters/http/showroomApi";
import { couponUsageScopeLabel } from "@/domain/showroom/couponStatus";
import { Button } from "@/ui/shared/Button";
import { ConfirmDialog } from "@/ui/shared/ConfirmDialog";
import { CouponTerms } from "./CouponTerms";

export function CouponApprovalInbox() {
  const [requests, setRequests] = useState<ShowroomCoupon[]>([]);
  const [stores, setStores] = useState<BaristaShowroom[]>([]);
  const [isAdmin, setAdmin] = useState(false);
  const [reviewerId, setReviewer] = useState("");
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<{
    coupon: ShowroomCoupon;
    storeId: string;
    accept: boolean;
  } | null>(null);
  const reload = async () => {
    const [inbox, all] = await Promise.all([
      fetchCouponApprovals(),
      fetchShowrooms(),
    ]);
    setRequests(inbox.requests);
    setAdmin(inbox.isAdmin);
    setReviewer(inbox.reviewerId);
    setStores(all);
  };
  useEffect(() => {
    let canceled = false;
    Promise.all([fetchCouponApprovals(), fetchShowrooms()])
      .then(([inbox, all]) => {
        if (!canceled) {
          setRequests(inbox.requests);
          setAdmin(inbox.isAdmin);
          setReviewer(inbox.reviewerId);
          setStores(all);
        }
      })
      .catch(() => {
        if (!canceled)
          setError("참여 요청을 확인하지 못했습니다. 새로고침해 주세요.");
      });
    return () => {
      canceled = true;
    };
  }, []);
  return (
    <div className="px-5">
      {requests.length ? (
        <section aria-label="쿠폰 참여 승인" className="mt-6">
          <h3 className="ds-h2">참여 요청 {requests.length}건</h3>
          {requests.map((coupon) => (
            <article
              key={coupon.id}
              className="space-y-3 border-b border-[var(--border-strong)] py-5"
            >
              <h4 className="ds-h3">{coupon.title}</h4>
              <p className="ds-body">
                {coupon.discountDetail} ·{" "}
                {couponUsageScopeLabel(coupon.usageScope)}
              </p>
              <p className="ds-body-s">
                발행 매장:{" "}
                {stores.find((store) => store.id === coupon.showroomId)
                  ?.storeName ?? coupon.showroomId}
              </p>
              <p className="ds-body-s">
                기간:{" "}
                {new Date(coupon.validFrom ?? coupon.createdAt).toLocaleString(
                  "ko-KR",
                  { timeZone: "Asia/Seoul" },
                )}{" "}
                ~{" "}
                {new Date(coupon.validUntil).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })}
              </p>
              <p className="ds-body-s">
                총 {coupon.totalLimit ?? "무제한"} · 고객당{" "}
                {coupon.perUserLimit ?? 1}장 · 비용 부담:{" "}
                {coupon.costBearer === "ISSUER" ? "발행 매장" : "사용 매장"}.
                자동 정산·송금 없음.
              </p>
              <CouponTerms coupon={coupon} />
              {coupon.approvals
                ?.filter(
                  (approval) =>
                    approval.status === "PENDING" &&
                    (approval.ownerId === reviewerId ||
                      (isAdmin && approval.storeId === "platform")),
                )
                .map((approval) => (
                  <div key={approval.storeId} className="flex flex-wrap gap-3">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setDecision({
                          coupon,
                          storeId: approval.storeId,
                          accept: false,
                        })
                      }
                    >
                      거절
                    </Button>
                    <Button
                      onClick={() =>
                        setDecision({
                          coupon,
                          storeId: approval.storeId,
                          accept: true,
                        })
                      }
                    >
                      {approval.storeId === "platform"
                        ? "전국 공용 승인"
                        : `${approval.storeName} 참여 동의`}
                    </Button>
                  </div>
                ))}
            </article>
          ))}
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="ds-body mt-3 text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {decision ? (
        <ConfirmDialog
          title={
            decision.accept
              ? "이 조건으로 참여할까요?"
              : "참여 요청을 거절할까요?"
          }
          description="등록된 혜택·사용 기간·비용 부담을 확인해 주세요. 승인 이후 이미 발급된 쿠폰의 조건은 변경할 수 없습니다."
          confirmText={decision.accept ? "동의 확정" : "거절 확정"}
          errorMessage="처리하지 못했습니다. 다시 확인해 주세요."
          onCancel={() => setDecision(null)}
          onConfirm={async () => {
            await decideCouponApproval(
              decision.coupon.id,
              decision.storeId,
              decision.accept,
            );
            await reload();
          }}
        />
      ) : null}
    </div>
  );
}
