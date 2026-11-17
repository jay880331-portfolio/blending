"use client";

import { useEffect, useRef, useState } from "react";

type PendingRef = { current: boolean };

export const CONFIRM_DIALOG_FAILURE_MESSAGE =
  "삭제에 실패했습니다. 다시 시도해주세요.";

export function canCloseConfirmDialog(pending: boolean) {
  return !pending;
}

export function isConfirmDialogBackdropClick(
  target: EventTarget | null,
  currentTarget: EventTarget | null,
) {
  return target === currentTarget;
}

export function restoreConfirmDialogFocus(
  target: { focus: () => void } | null,
) {
  target?.focus();
}

export async function runConfirmDialogAction(
  onConfirm: () => void | Promise<void>,
  pending: PendingRef,
) {
  if (pending.current) return "ignored" as const;
  pending.current = true;
  try {
    await onConfirm();
    return "confirmed" as const;
  } catch {
    return "failed" as const;
  } finally {
    pending.current = false;
  }
}

export function ConfirmDialog({
  title = "삭제하시겠습니까?",
  description,
  confirmText = "삭제",
  pendingText,
  cancelText = "취소",
  errorMessage = CONFIRM_DIALOG_FAILURE_MESSAGE,
  onCancel,
  onConfirm,
}: {
  title?: string;
  description?: string;
  confirmText?: string;
  pendingText?: string;
  cancelText?: string;
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const submittingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const close = () => {
    if (canCloseConfirmDialog(pending || submittingRef.current)) onCancel();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      dialog?.close();
      queueMicrotask(() => restoreConfirmDialogFocus(previousFocusRef.current));
    };
  }, []);
  const confirm = async () => {
    setPending(true);
    setError(false);
    const result = await runConfirmDialogAction(onConfirm, submittingRef);
    if (result === "ignored") return;
    setPending(false);
    if (result === "confirmed") onCancel();
    else setError(true);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (isConfirmDialogBackdropClick(event.target, event.currentTarget))
          close();
      }}
      className="m-auto w-full max-w-md border-0 bg-transparent p-6 backdrop:bg-[rgba(0,0,0,0.35)]"
    >
      <div className="rounded-[var(--radius-xl)] bg-[var(--surface)] p-5">
        <h2 className="text-[20px] font-bold text-[var(--fg-strong)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-[14px] leading-[1.5] text-[var(--fg-muted)]">
            {description}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 text-[14px] text-[var(--danger)]">
            {errorMessage}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" disabled={pending} onClick={close}>
            {cancelText}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void confirm()}
            className="rounded-[var(--radius-lg)] bg-[var(--accent)] px-5 py-3 text-[var(--surface)] disabled:opacity-40"
          >
            {pending ? pendingText || `${confirmText} 중...` : confirmText}
          </button>
        </div>
      </div>
    </dialog>
  );
}
