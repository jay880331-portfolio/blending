"use client";
import type { ReportTargetType } from "@blending/admin-contracts";
import { useEffect, useRef, useState } from "react";
import { createReport } from "@/adapters/http/reportApi";
import { dispatchBlockedUser } from "@/ui/shared/blockedUserEvent";
export function ReportDialog({
  targetType,
  targetId,
  parentId,
  authorId,
  isOwnTarget = false,
  onClose,
}: {
  targetType: ReportTargetType;
  targetId: string;
  parentId?: string;
  authorId?: string;
  isOwnTarget?: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState(""),
    [blocked, setBlocked] = useState(false),
    [done, setDone] = useState(false),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);
  async function submit(form: FormData) {
    setSaving(true);
    setError("");
    try {
      const blockedUserId =
        authorId && !isOwnTarget && form.get("block") ? authorId : undefined;
      await createReport({
        targetType,
        targetId,
        ...(parentId ? { parentId } : {}),
        reason: String(form.get("reason")) as "spam",
        detail: String(form.get("detail") || ""),
        ...(blockedUserId ? { blockUserId: blockedUserId } : {}),
      });
      if (blockedUserId) dispatchBlockedUser(blockedUserId);
      setBlocked(Boolean(blockedUserId));
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "신고 실패");
    } finally {
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-label="신고하기"
      className="m-auto w-full max-w-md border-0 bg-transparent p-6 backdrop:bg-[rgba(0,0,0,0.35)]"
    >
      <div className="w-full max-w-md rounded-[var(--radius-xl)] bg-[var(--surface)] p-5">
        <h2 className="text-[20px] font-bold">신고하기</h2>
        {done ? (
          <>
            <p role="status" className="mt-4">
              {blocked
                ? "신고가 접수됐고 사용자를 차단해 콘텐츠를 화면에서 제거했습니다."
                : "신고가 접수됐습니다."}
            </p>
            <button type="button" className="mt-5" onClick={onClose}>
              닫기
            </button>
          </>
        ) : (
          <form action={submit} className="mt-4 grid gap-4">
            <label>
              신고 사유
              <select
                name="reason"
                className="block w-full border border-[var(--border-strong)] p-3"
              >
                <option value="spam">스팸</option>
                <option value="abuse">욕설·괴롭힘</option>
                <option value="privacy">개인정보 침해</option>
                <option value="fraud">사기</option>
                <option value="other">기타</option>
              </select>
            </label>
            {authorId && !isOwnTarget ? (
              <label className="flex items-center gap-2 text-[14px] font-bold">
                <input name="block" type="checkbox" />
                신고하고 이 사용자 차단
              </label>
            ) : null}
            <label>
              상세 내용
              <textarea
                name="detail"
                required
                minLength={20}
                maxLength={1000}
                className="block min-h-32 w-full border border-[var(--border-strong)] p-3"
              />
            </label>
            {error && (
              <p role="alert" className="text-[var(--danger)]">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose}>
                취소
              </button>
              <button
                disabled={saving}
                className="rounded-[var(--radius-lg)] bg-[var(--accent)] px-5 py-3 text-[var(--surface)]"
              >
                접수
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
