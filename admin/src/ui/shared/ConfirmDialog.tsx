"use client";

import { useEffect, useRef, useState } from "react";

export function ConfirmDialog({
  open,
  title = "확인",
  children,
  onConfirm,
  onCancel,
  confirmDisabled = false,
  validationError,
}: {
  open: boolean;
  title?: string;
  children?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  confirmDisabled?: boolean;
  validationError?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const handled = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      handled.current = false;
      trigger.current = document.activeElement as HTMLElement;
      dialog.showModal();
    } else if (dialog.open) {
      handled.current = true;
      dialog.close();
      trigger.current?.focus();
    }
  }, [open]);

  const closeDialog = () => {
    if (handled.current) return;
    handled.current = true;
    if (ref.current?.open) ref.current.close();
    onCancel();
    trigger.current?.focus();
  };
  const cancel = () => {
    if (pending) return;
    closeDialog();
  };
  const confirm = async () => {
    if (confirmDisabled || pending) return;
    setPending(true);
    setError(undefined);
    try {
      await onConfirm();
      setPending(false);
      closeDialog();
    } catch (cause) {
      setPending(false);
      setError(cause instanceof Error ? cause.message : "요청에 실패했습니다.");
    }
  };

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
    >
      <h2>{title}</h2>
      {children}
      {(validationError || error) && (
        <p role="alert">{error ?? validationError}</p>
      )}
      <button type="button" disabled={pending} onClick={cancel}>
        취소
      </button>
      <button
        type="button"
        disabled={confirmDisabled || pending}
        onClick={() => void confirm()}
      >
        {pending ? "처리 중…" : "확인"}
      </button>
    </dialog>
  );
}
