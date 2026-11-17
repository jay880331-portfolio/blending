"use client";

import Link from "next/link";
import { MoreVertical } from "lucide-react";
import { useRef, useState } from "react";
import { ReportDialog } from "@/ui/shared/ReportDialog";
import { ConfirmDialog } from "@/ui/shared/ConfirmDialog";

export function ContentActionMenu({
  editHref,
  onEdit,
  onDelete,
  deleting,
  label = "콘텐츠",
  report,
}: {
  editHref?: string;
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
  deleting?: boolean;
  label?: string;
  report?: { targetId: string; authorId?: string };
}) {
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const canManage = Boolean(onDelete);
  const closeReport = () => {
    setReportOpen(false);
    queueMicrotask(() => triggerRef.current?.focus());
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${label} 더보기`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] text-[var(--fg-muted)]"
      >
        <MoreVertical size={24} />
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-30 w-36 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] py-2 shadow-[var(--shadow-modal)]">
          {canManage && editHref ? (
            <Link
              href={editHref}
              className="block px-4 py-3 text-[15px] font-medium text-[var(--fg)]"
              onClick={() => setOpen(false)}
            >
              수정하기
            </Link>
          ) : canManage ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onEdit?.();
              }}
              className="block w-full px-4 py-3 text-left text-[15px] font-medium text-[var(--fg)]"
            >
              수정하기
            </button>
          ) : null}
          {canManage ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmOpen(true);
              }}
              disabled={deleting}
              className="block w-full px-4 py-3 text-left text-[15px] font-medium text-[var(--accent)] disabled:opacity-40"
            >
              {deleting ? "삭제 중" : "삭제하기"}
            </button>
          ) : null}
          {report ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setReportOpen(true);
              }}
              className="block w-full px-4 py-3 text-left text-[15px] font-medium text-[var(--fg)]"
            >
              신고
            </button>
          ) : null}
        </div>
      ) : null}
      {reportOpen && report ? (
        <ReportDialog
          targetType="content"
          targetId={report.targetId}
          authorId={report.authorId}
          onClose={closeReport}
        />
      ) : null}
      {confirmOpen && onDelete ? (
        <ConfirmDialog
          onCancel={() => {
            setConfirmOpen(false);
            queueMicrotask(() => triggerRef.current?.focus());
          }}
          onConfirm={onDelete}
        />
      ) : null}
    </div>
  );
}
