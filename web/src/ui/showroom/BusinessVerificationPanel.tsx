"use client";

import { useState } from "react";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import {
  formatBusinessNumber,
  isValidBusinessNumber,
} from "@/domain/showroom/businessNumber";
import type { BaristaShowroom } from "@/domain/showroom/types";

export function BusinessVerificationPanel({
  showroom,
  onUpdated,
}: {
  showroom: BaristaShowroom;
  onUpdated: (next: BaristaShowroom) => void;
}) {
  const verification = showroom.businessVerification;
  const [businessNumber, setBusinessNumber] = useState(
    verification?.number ? formatBusinessNumber(verification.number) : "",
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setMessage(null);
    if (!isValidBusinessNumber(businessNumber)) {
      setError("유효한 10자리 사업자등록번호를 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/showroom/my/business-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessNumber }),
      });
      const data = (await res.json().catch(() => null)) as {
        showroom?: BaristaShowroom;
        error?: string;
      } | null;
      if (!res.ok || !data?.showroom) {
        throw new Error(data?.error || "사업자 인증 신청에 실패했습니다.");
      }
      onUpdated(data.showroom);
      setMessage(
        "사업자 인증이 신청되었습니다. 관리자 승인 후 여권·원두 예약이 열립니다.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "사업자 인증 신청에 실패했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-6 px-5">
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-[15px] font-bold text-[var(--fg-strong)]">
            {verification?.status === "VERIFIED" ? (
              <CheckCircle2 size={17} className="text-[var(--success)]" />
            ) : (
              <ShieldAlert size={17} className="text-[var(--fg-muted)]" />
            )}
            사업자 인증
          </h3>
          <span className="rounded-[var(--radius-pill)] bg-[var(--surface-alt)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--fg-strong)]">
            {!verification
              ? "미등록"
              : verification.status === "VERIFIED"
                ? "인증 완료"
                : verification.status === "REJECTED"
                  ? "반려됨"
                  : "심사 중"}
          </span>
        </div>

        <p className="mt-2 text-[12px] leading-[1.45] text-[var(--fg-muted)]">
          {!verification
            ? "사업자등록번호를 인증하면 커피 여권 스탬프·포인트 교환·원두 예약 기능을 운영할 수 있습니다."
            : verification.status === "VERIFIED"
              ? `인증된 사업자번호: ${formatBusinessNumber(verification.number)}. 번호를 변경해 재제출하면 다시 심사 중(PENDING)으로 전환되어 승인 전까지 여권·예약 기능이 중단됩니다.`
              : verification.status === "REJECTED"
                ? `반려 사유: ${verification.rejectReason || "사유 없음"}. 번호를 확인해 재제출해주세요.`
                : `심사 중입니다 (${formatBusinessNumber(verification.number)}). 관리자 승인 후 여권·예약 기능이 열립니다.`}
        </p>

        <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
          <input
            type="text"
            value={businessNumber}
            onChange={(e) => setBusinessNumber(e.target.value)}
            placeholder="000-00-00000"
            className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={saving}
            className="shrink-0 rounded-[var(--radius-md)] bg-[var(--fg)] px-3.5 py-2 text-[12px] font-bold text-[var(--surface)] disabled:opacity-50"
          >
            {saving ? "제출 중..." : verification ? "재제출" : "인증 신청"}
          </button>
        </form>

        {error ? (
          <p className="mt-2 text-[12px] font-bold text-[var(--danger)]">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-2 text-[12px] font-bold text-[var(--success)]">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
