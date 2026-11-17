"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  Heart,
  MessageSquare,
  MoreVertical,
  Pencil,
  Trash2,
  UserRound,
} from "lucide-react";
import { formatRelativeTime } from "@/domain/member/dateTime";
import { ReportDialog } from "@/ui/shared/ReportDialog";
import { ConfirmDialog } from "@/ui/shared/ConfirmDialog";

export type CommentThreadComment = {
  id: string;
  authorId?: string;
  authorName: string;
  authorAvatarUrl?: string;
  createdAgo: string;
  createdAt?: string;
  body: string;
  likes: number;
  isOwner?: boolean;
  canManage?: boolean;
  isAuthor?: boolean;
  isDeleted?: boolean;
  isWithdrawnAuthor?: boolean;
  replies?: CommentThreadComment[];
};

type CommentLikeState = { liked: boolean; likes: number };

type CommentThreadProps<TComment extends CommentThreadComment> = {
  contentId: string;
  comments: TComment[];
  commentCount: number;
  headerAction?: ReactNode;
  value: string;
  submitting: boolean;
  getLikeState: (comment: TComment) => CommentLikeState;
  onToggleLike: (comment: TComment) => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onUpdate: (contentId: string, commentId: string, body: string) => void;
  onRemove: (contentId: string, commentId: string) => void;
  onReply?: (contentId: string, commentId: string, reply: TComment) => void;
  requestUpdate: (
    contentId: string,
    commentId: string,
    body: string,
  ) => Promise<{ success: boolean }>;
  requestDelete: (
    contentId: string,
    commentId: string,
  ) => Promise<{ success: boolean }>;
  requestReply?: (
    contentId: string,
    commentId: string,
    body: string,
  ) => Promise<TComment>;
  fixedInput?: boolean;
  alwaysShowInput?: boolean;
};

export function supportsCommentReplies<TComment extends CommentThreadComment>(
  handlers?: Pick<CommentThreadProps<TComment>, "onReply" | "requestReply">,
) {
  return Boolean(handlers?.onReply && handlers.requestReply);
}

export function visualViewportKeyboardOffset(
  layoutViewportHeight: number,
  visualViewportHeight: number,
  visualViewportOffsetTop: number,
) {
  return Math.max(
    0,
    layoutViewportHeight - visualViewportHeight - visualViewportOffsetTop,
  );
}

export function CommentThread<TComment extends CommentThreadComment>({
  contentId,
  comments,
  commentCount,
  headerAction,
  value,
  submitting,
  getLikeState,
  onToggleLike,
  onChange,
  onSubmit,
  onUpdate,
  onRemove,
  onReply,
  requestUpdate,
  requestDelete,
  requestReply,
  fixedInput = true,
  alwaysShowInput = false,
}: CommentThreadProps<TComment>) {
  const hasComments = comments.length > 0;
  const [sortOrder, setSortOrder] = useState<"oldest" | "latest">("latest");
  const [writing, setWriting] = useState(false);
  const [replyTarget, setReplyTarget] = useState<TComment | null>(null);
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const repliesEnabled = supportsCommentReplies({ onReply, requestReply });
  const inputRef = useRef<HTMLInputElement>(null);
  const saving = submitting || replySubmitting;
  const showInput =
    alwaysShowInput ||
    hasComments ||
    writing ||
    Boolean(value.trim()) ||
    Boolean(replyTarget);
  const sortedComments = comments
    .map((comment, index) => ({
      comment,
      index,
      time: comment.createdAt ? new Date(comment.createdAt).getTime() : NaN,
    }))
    .sort((a, b) => {
      const byTime =
        Number.isFinite(a.time) && Number.isFinite(b.time)
          ? a.time - b.time
          : a.index - b.index;
      return sortOrder === "oldest" ? byTime : -byTime;
    })
    .map(({ comment }) => comment);

  useEffect(() => {
    if (!fixedInput) return;
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const updateKeyboardOffset = () => {
      setKeyboardOffset(
        visualViewportKeyboardOffset(
          window.innerHeight,
          visualViewport.height,
          visualViewport.offsetTop,
        ),
      );
    };

    updateKeyboardOffset();
    visualViewport.addEventListener("resize", updateKeyboardOffset);
    visualViewport.addEventListener("scroll", updateKeyboardOffset);

    return () => {
      visualViewport.removeEventListener("resize", updateKeyboardOffset);
      visualViewport.removeEventListener("scroll", updateKeyboardOffset);
    };
  }, [fixedInput]);

  return (
    <section
      className={cn(
        "mt-8 border-t-8 border-[var(--border)] pt-6",
        showInput ? "pb-24" : "pb-6",
      )}
    >
      <div className="mb-6 flex items-center justify-between text-[14px] font-bold text-[var(--fg-muted)]">
        <div className="flex items-center gap-3">
          <h2>댓글 {commentCount}</h2>
          {headerAction}
        </div>
        {hasComments ? (
          <div className="flex gap-3">
            <button
              type="button"
              aria-pressed={sortOrder === "oldest"}
              onClick={() => setSortOrder("oldest")}
              className={cn(sortOrder === "oldest" && "text-[var(--fg)]")}
            >
              등록순
            </button>
            <button
              type="button"
              aria-pressed={sortOrder === "latest"}
              onClick={() => setSortOrder("latest")}
              className={cn(sortOrder === "latest" && "text-[var(--fg)]")}
            >
              최신순
            </button>
          </div>
        ) : null}
      </div>
      <div className="space-y-6">
        {sortedComments.map((item) => (
          <CommentBlock
            key={item.id}
            contentId={contentId}
            comment={item}
            getLikeState={getLikeState}
            onToggleLike={onToggleLike}
            onUpdate={onUpdate}
            onRemove={onRemove}
            onStartReply={
              repliesEnabled
                ? (comment) => {
                    setReplyTarget(comment);
                    setWriting(true);
                    onChange("");
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }
                : undefined
            }
            showReplies={repliesEnabled}
            requestUpdate={requestUpdate}
            requestDelete={requestDelete}
          />
        ))}
      </div>
      {!hasComments ? (
        <div className="py-8 text-center">
          <p className="text-[14px] font-bold text-[var(--fg-subtle)]">
            첫 댓글을 남겨보세요.
          </p>
          {!showInput ? (
            <button
              type="button"
              onClick={() => {
                setWriting(true);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--surface-alt)] px-4 py-3 text-[13px] font-bold text-[var(--fg)]"
            >
              <Pencil size={15} strokeWidth={2} />
              댓글 쓰기
            </button>
          ) : null}
        </div>
      ) : null}
      {showInput ? (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (replyTarget && onReply && requestReply) {
              if (!value.trim() || saving) return;

              setReplySubmitting(true);
              try {
                const reply = await requestReply(
                  contentId,
                  replyTarget.id,
                  value.trim(),
                );
                onReply(contentId, replyTarget.id, reply);
                onChange("");
                setReplyTarget(null);
              } catch (error) {
                window.alert(
                  error instanceof Error
                    ? error.message
                    : "답글 등록에 실패했습니다.",
                );
              } finally {
                setReplySubmitting(false);
              }
              return;
            }

            onSubmit();
          }}
          className={cn(
            "inset-x-0 z-30 mx-auto max-w-[var(--app-shell-max-width)] border-t border-[var(--border)] bg-[var(--surface)] px-5 py-3",
            fixedInput
              ? "fixed bottom-[var(--app-bottom-nav-height)]"
              : "sticky bottom-0",
          )}
          style={
            fixedInput
              ? {
                  bottom: `max(var(--app-bottom-nav-height), ${keyboardOffset}px)`,
                }
              : undefined
          }
        >
          {replyTarget ? (
            <div className="mb-2 flex items-center justify-between gap-3 text-[12px] font-bold">
              <p className="min-w-0 truncate text-[var(--fg-muted)]">
                {replyTarget.authorName}님에게 답글 작성 중
              </p>
              <button
                type="button"
                onClick={() => {
                  setReplyTarget(null);
                  onChange("");
                }}
                className="shrink-0 text-[var(--fg-subtle)]"
              >
                취소
              </button>
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            <label className="flex min-h-11 flex-1 items-center rounded-[var(--radius-pill)] bg-[var(--surface-alt)] px-4">
              <input
                ref={inputRef}
                value={value}
                disabled={saving}
                onChange={(event) => onChange(event.target.value)}
                placeholder={
                  replyTarget ? "답글을 입력해주세요." : "댓글을 입력해주세요."
                }
                className="min-w-0 flex-1 bg-transparent text-[15px] font-bold outline-none placeholder:text-[var(--fg-subtle)] disabled:opacity-60"
              />
            </label>
            {value.trim() ? (
              <button
                type="submit"
                disabled={saving}
                aria-label={replyTarget ? "답글 등록" : "댓글 등록"}
                className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--accent)] text-white disabled:opacity-40"
              >
                <ArrowUp size={20} strokeWidth={2.2} />
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}

function CommentBlock<TComment extends CommentThreadComment>({
  contentId,
  comment,
  nested = false,
  getLikeState,
  onToggleLike,
  onUpdate,
  onRemove,
  onStartReply,
  showReplies,
  requestUpdate,
  requestDelete,
}: {
  contentId: string;
  comment: TComment;
  nested?: boolean;
  getLikeState: (comment: TComment) => CommentLikeState;
  onToggleLike: (comment: TComment) => void;
  onUpdate: (contentId: string, commentId: string, body: string) => void;
  onRemove: (contentId: string, commentId: string) => void;
  onStartReply?: (comment: TComment) => void;
  showReplies: boolean;
  requestUpdate: (
    contentId: string,
    commentId: string,
    body: string,
  ) => Promise<{ success: boolean }>;
  requestDelete: (
    contentId: string,
    commentId: string,
  ) => Promise<{ success: boolean }>;
}) {
  const likeState = getLikeState(comment);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const canReply =
    Boolean(onStartReply) &&
    !nested &&
    !comment.isDeleted &&
    !comment.id.startsWith("pending-");
  const canManage =
    !comment.isDeleted &&
    !comment.id.startsWith("pending-") &&
    (comment.canManage ?? comment.isOwner);
  const canReport =
    !comment.isDeleted &&
    !comment.id.startsWith("pending-") &&
    !comment.isOwner &&
    Boolean(comment.authorId);
  const showMenuButton = !editing && (canReply || canManage || canReport);
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const saveComment = async () => {
    if (!draft.trim() || saving) return;

    setSaving(true);
    try {
      await requestUpdate(contentId, comment.id, draft.trim());
      onUpdate(contentId, comment.id, draft.trim());
      setEditing(false);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "댓글 수정에 실패했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };
  const removeComment = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await requestDelete(contentId, comment.id);
      onRemove(contentId, comment.id);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "댓글 삭제에 실패했습니다.",
      );
    } finally {
      setDeleting(false);
    }
  };
  return (
    <div className={cn(nested && "ml-10")}>
      <div className="grid grid-cols-[36px_minmax(0,1fr)_32px] gap-3">
        {comment.authorAvatarUrl && !comment.isWithdrawnAuthor ? (
          <Image
            src={comment.authorAvatarUrl}
            alt=""
            width={36}
            height={36}
            sizes="36px"
            className="h-9 w-9 rounded-[var(--radius-pill)] object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--surface-alt)] text-[var(--fg-muted)]">
            <UserRound size={17} />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <p
              className={cn(
                "min-w-0 text-[13px] font-bold",
                comment.isDeleted && "text-[var(--fg-subtle)]",
              )}
            >
              {comment.authorName}{" "}
              <span className="ml-1 whitespace-nowrap font-normal text-[var(--fg-subtle)]">
                {formatRelativeTime(comment.createdAt, comment.createdAgo)}
              </span>
              {comment.isAuthor ? (
                <span className="ml-2 rounded-[var(--radius-sm)] bg-[var(--accent)] px-2 py-0.5 text-[10px] text-white">
                  작성자
                </span>
              ) : null}
            </p>
          </div>
          {editing ? (
            <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--border-strong)] p-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="min-h-20 w-full resize-none bg-transparent text-[14px] leading-[1.7] outline-none"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(comment.body);
                    setEditing(false);
                  }}
                  className="px-3 py-2 text-[12px] font-bold text-[var(--fg-muted)]"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={saveComment}
                  disabled={saving}
                  className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-40"
                >
                  {saving ? "저장 중" : "저장"}
                </button>
              </div>
            </div>
          ) : (
            <p
              className={cn(
                "mt-2 text-[14px] leading-[1.7]",
                comment.isDeleted && "font-bold text-[var(--fg-muted)]",
              )}
            >
              {comment.body}
            </p>
          )}
          {!comment.isDeleted ? (
            <div className="mt-3 flex items-center gap-4 text-[12px] text-[var(--fg-muted)]">
              <button
                type="button"
                aria-label={`댓글 좋아요 ${formatCompactCount(likeState.likes)}`}
                onClick={() => onToggleLike(comment)}
                className={cn(
                  "flex items-center gap-1",
                  likeState.liked && "text-[var(--accent)]",
                )}
              >
                <Heart
                  size={13}
                  fill={likeState.liked ? "currentColor" : "none"}
                />
                좋아요 {formatCompactCount(likeState.likes)}
              </button>
            </div>
          ) : null}
        </div>
        {showMenuButton ? (
          <button
            ref={menuTriggerRef}
            type="button"
            aria-label="댓글 메뉴 열기"
            onClick={() => setMenuOpen(true)}
            className="flex h-8 w-8 items-start justify-center justify-self-end text-[var(--fg-muted)]"
          >
            <MoreVertical size={18} strokeWidth={2} />
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
      {menuOpen ? (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="댓글 메뉴 닫기"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/20"
          />
          <div className="comment-action-sheet absolute inset-x-0 bottom-0 mx-auto max-w-[var(--app-shell-max-width)] rounded-t-[var(--radius-xl)] bg-[var(--surface)] px-6 pb-[calc(var(--app-safe-area-bottom)+16px)] pt-3 shadow-[0_-8px_28px_rgba(0,0,0,0.12)]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-[var(--radius-pill)] bg-[var(--border-strong)]" />
            <div className="divide-y divide-[var(--border)] text-[16px] font-bold">
              {canReply ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onStartReply?.(comment);
                  }}
                  className="flex w-full items-center gap-3 py-4 text-left text-[var(--fg)]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--surface-alt)] text-[var(--fg-muted)]">
                    <MessageSquare size={18} strokeWidth={1.8} />
                  </span>
                  <span>답글 달기</span>
                </button>
              ) : null}
              {canManage ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setEditing(true);
                  }}
                  className="flex w-full items-center gap-3 py-4 text-left text-[var(--fg)]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--surface-alt)] text-[var(--fg-muted)]">
                    <Pencil size={18} strokeWidth={1.8} />
                  </span>
                  <span>수정</span>
                </button>
              ) : null}
              {canManage ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmOpen(true);
                  }}
                  disabled={deleting}
                  className="flex w-full items-center gap-3 py-4 text-left text-[var(--accent)] disabled:opacity-40"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--surface-alt)]">
                    <Trash2 size={18} strokeWidth={1.8} />
                  </span>
                  <span>{deleting ? "삭제 중" : "삭제"}</span>
                </button>
              ) : null}
              {canReport ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setReportOpen(true);
                  }}
                  className="flex w-full items-center gap-3 py-4 text-left text-[var(--fg)]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--surface-alt)] text-[var(--fg-muted)]">
                    <MoreVertical size={18} strokeWidth={1.8} />
                  </span>
                  <span>신고</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {reportOpen ? (
        <ReportDialog
          targetType="comment"
          targetId={comment.id}
          parentId={contentId}
          authorId={comment.authorId}
          onClose={() => setReportOpen(false)}
        />
      ) : null}
      {confirmOpen ? (
        <ConfirmDialog
          onCancel={() => {
            setConfirmOpen(false);
            queueMicrotask(() => menuTriggerRef.current?.focus());
          }}
          onConfirm={removeComment}
        />
      ) : null}
      {showReplies && comment.replies?.length ? (
        <div className="mt-5 space-y-5">
          {comment.replies.map((reply) => (
            <CommentBlock
              key={reply.id}
              contentId={contentId}
              comment={reply as TComment}
              nested
              getLikeState={getLikeState}
              onToggleLike={onToggleLike}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onStartReply={onStartReply}
              showReplies={showReplies}
              requestUpdate={requestUpdate}
              requestDelete={requestDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatCompactCount(value: number) {
  return value >= 1000
    ? `${Number((value / 1000).toFixed(1))}k`
    : String(value);
}

function cn(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}
