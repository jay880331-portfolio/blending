"use client";
import { useEffect, useRef } from "react";
export function DetailDrawer({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const handled = useRef(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      handled.current = false;
      trigger.current = document.activeElement as HTMLElement;
      d.showModal();
    } else if (d.open) {
      handled.current = true;
      d.close();
      trigger.current?.focus();
    }
  }, [open]);
  const close = () => {
    if (handled.current) return;
    handled.current = true;
    if (ref.current?.open) ref.current.close();
    onClose();
    trigger.current?.focus();
  };
  return (
    <dialog ref={ref} onCancel={close} aria-label={title}>
      <button onClick={close}>닫기</button>
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
