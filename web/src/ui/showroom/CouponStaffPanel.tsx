"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/ui/shared/Button";
import { readCouponResponse as couponJson } from "@/adapters/http/showroomApi";

type StaffRequestRow = {
  id: string;
  userId: string;
  userName?: string;
  userHandle?: string;
  createdAt: string;
};

export function CouponStaffPanel() {
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [requests, setRequests] = useState<StaffRequestRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [staffData, reqData] = await Promise.all([
      couponJson<{ staff: { id: string; name: string }[] }>(
        await fetch("/api/showroom/coupon-staff", { cache: "no-store" }),
      ),
      couponJson<{ requests: StaffRequestRow[] }>(
        await fetch("/api/showroom/staff-requests", { cache: "no-store" }),
      ),
    ]);
    setStaff(staffData.staff);
    setRequests(reqData.requests);
  };

  useEffect(() => {
    let canceled = false;
    void Promise.all([
      fetch("/api/showroom/coupon-staff", { cache: "no-store" }).then(
        couponJson<{ staff: { id: string; name: string }[] }>,
      ),
      fetch("/api/showroom/staff-requests", { cache: "no-store" }).then(
        couponJson<{ requests: StaffRequestRow[] }>,
      ),
    ])
      .then(([staffData, reqData]) => {
        if (canceled) return;
        setStaff(staffData.staff);
        setRequests(reqData.requests);
      })
      .catch(() => {
        if (!canceled) setError("직원 정보를 불러오지 못했습니다.");
      });
    return () => {
      canceled = true;
    };
  }, []);

  const revokeStaff = async (userId: string) => {
    setBusy(true);
    setError("");
    try {
      await couponJson(
        await fetch("/api/showroom/coupon-staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, revoke: true }),
        }),
      );
      await load();
    } catch (f) {
      setError(
        f instanceof Error ? f.message : "직원 권한 해제에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  };

  const decideRequest = async (
    requestId: string,
    decision: "approve" | "reject",
  ) => {
    setBusy(true);
    setError("");
    try {
      await couponJson(
        await fetch(
          `/api/showroom/staff-requests/${encodeURIComponent(requestId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ decision }),
          },
        ),
      );
      await load();
    } catch (f) {
      setError(
        f instanceof Error ? f.message : "직원 신청 처리에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="space-y-4 border-b border-[var(--border-strong)] px-5 py-6"
      aria-label="직원 쿠폰 스캔 안내"
    >
      <h2 className="ds-h2">고객 쿠폰을 스캔하세요</h2>
      <p className="ds-body text-[var(--fg-muted)]">
        고객이 보여주는 일회용 QR을 스캔하고 혜택을 POS에 반영해 주세요.
        관리자는 바로 처리할 수 있어요.
      </p>
      <Link href="/showroom/scan" className="ds-body inline-block underline">
        직원 쿠폰 스캔 열기
      </Link>
      <details open={requests.length > 0}>
        <summary className="ds-h3 cursor-pointer">
          직원 관리{requests.length > 0 ? ` (대기 ${requests.length})` : ""}
        </summary>
        <p className="ds-body-s my-3 text-[var(--fg-muted)]">
          바리스타가 마이페이지 &gt; 매장 직원 신청에서 요청하면 이곳에서
          승인·거절할 수 있습니다.
        </p>

        {requests.length > 0 ? (
          <div className="mb-4 space-y-2">
            <p className="text-[12px] font-bold text-[var(--fg-strong)]">
              가입 신청 대기
            </p>
            {requests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-[var(--fg-strong)]">
                    {req.userName || "바리스타"}
                    {req.userHandle ? ` (@${req.userHandle})` : ""}
                  </p>
                  <p className="text-[11px] text-[var(--fg-muted)]">
                    {new Date(req.createdAt).toLocaleDateString("ko-KR")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decideRequest(req.id, "approve")}
                    className="rounded-[var(--radius-md)] bg-[var(--fg)] px-2.5 py-1 text-[12px] font-bold text-[var(--surface)] disabled:opacity-50"
                  >
                    승인
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decideRequest(req.id, "reject")}
                    className="rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-1 text-[12px] text-[var(--fg-muted)] disabled:opacity-50"
                  >
                    거절
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {staff.length === 0 ? (
          <p className="py-2 text-[13px] text-[var(--fg-muted)]">
            등록된 활성 직원이 없습니다.
          </p>
        ) : (
          staff.map((person) => (
            <div
              key={person.id}
              className="flex items-center justify-between border-b border-[var(--border)] py-3"
            >
              <span>{person.name}</span>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void revokeStaff(person.id)}
              >
                권한 해제
              </Button>
            </div>
          ))
        )}
      </details>
      {error ? (
        <p role="alert" className="ds-body text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
