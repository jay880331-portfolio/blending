"use client";

import type {
  AdminContentKind,
  AdminContentReactionDto,
  AdminCommentDto,
} from "@blending/admin-contracts";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  deleteContent,
  deleteContentReaction,
  fetchContent,
  fetchContentReactions,
  hideContent,
  restoreContent,
} from "../../adapters/http/contentApi";
import {
  deleteComment,
  fetchComments,
  restoreComment,
} from "../../adapters/http/moderationApi";
import { AsyncState } from "../shared/AsyncState";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { DataTable, type DataColumn } from "../shared/DataTable";
import { FormField } from "../shared/FormField";
import { StatusBadge } from "../shared/StatusBadge";
import { CONTENT_KIND_LABELS } from "./contentForm";
import {
  commentParentKind,
  contentAuditLogsHref,
  contentCommentsQuery,
  shouldRenderContentReactionSection,
} from "./contentKind";
import styles from "./content.module.css";

type LifecycleAction = "hide" | "delete" | "restore";
type CommentAction = { comment: AdminCommentDto; restore: boolean };

export function ContentDetailScreen({
  kind,
  id,
}: {
  kind: AdminContentKind;
  id: string;
}) {
  const [content, setContent] =
    useState<Awaited<ReturnType<typeof fetchContent>>>();
  const [error, setError] = useState("");
  const [action, setAction] = useState<LifecycleAction>();
  const [reactionPage, setReactionPage] = useState(1);
  const [reactions, setReactions] =
    useState<Awaited<ReturnType<typeof fetchContentReactions>>>();
  const [reactionError, setReactionError] = useState("");
  const [removingReaction, setRemovingReaction] =
    useState<AdminContentReactionDto>();
  const [commentPage, setCommentPage] = useState(1);
  const [comments, setComments] =
    useState<Awaited<ReturnType<typeof fetchComments>>>();
  const [commentError, setCommentError] = useState("");
  const [commentAction, setCommentAction] = useState<CommentAction>();
  const supportsReactions = shouldRenderContentReactionSection(kind);
  const parentKind = commentParentKind(kind);

  const load = useCallback(
    () =>
      fetchContent(kind, id)
        .then((next) => {
          setContent(next);
          setError("");
        })
        .catch((cause) =>
          setError(cause instanceof Error ? cause.message : "조회 실패"),
        ),
    [id, kind],
  );
  const loadReactions = useCallback(
    () =>
      fetchContentReactions(kind, id, reactionPage)
        .then((next) => {
          setReactions(next);
          setReactionError("");
        })
        .catch((cause) =>
          setReactionError(
            cause instanceof Error ? cause.message : "반응 조회 실패",
          ),
        ),
    [id, kind, reactionPage],
  );
  const loadComments = useCallback(() => {
    if (!parentKind) return Promise.resolve();
    return fetchComments(contentCommentsQuery(parentKind, id, commentPage))
      .then((next) => {
        setComments(next);
        setCommentError("");
      })
      .catch((cause) =>
        setCommentError(
          cause instanceof Error ? cause.message : "댓글 조회 실패",
        ),
      );
  }, [commentPage, id, parentKind]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (supportsReactions) void loadReactions();
  }, [loadReactions, supportsReactions]);
  useEffect(() => {
    if (parentKind) void loadComments();
  }, [loadComments, parentKind]);

  const runLifecycle = async (reason: string) => {
    if (!action) return;
    const next =
      action === "hide"
        ? await hideContent(kind, id, reason)
        : action === "delete"
          ? await deleteContent(kind, id, reason)
          : await restoreContent(kind, id, reason);
    setContent(next);
    setAction(undefined);
  };

  const reactionColumns: DataColumn<AdminContentReactionDto>[] = [
    {
      key: "userId",
      label: "사용자",
      render: (reaction) =>
        reaction.userId ? (
          <Link href={`/users/${reaction.userId}`}>{reaction.userId}</Link>
        ) : (
          "비회원"
        ),
    },
    {
      key: "createdAt",
      label: "등록일",
      render: (reaction) =>
        new Date(reaction.createdAt).toLocaleString("ko-KR"),
    },
    {
      key: "action",
      label: "관리",
      render: (reaction) => (
        <button type="button" onClick={() => setRemovingReaction(reaction)}>
          삭제
        </button>
      ),
    },
  ];
  const commentColumns: DataColumn<AdminCommentDto>[] = [
    {
      key: "author",
      label: "작성자",
      render: (comment) =>
        comment.ownerId ? (
          <Link href={`/users/${comment.ownerId}`}>
            {comment.authorName ?? comment.ownerId}
          </Link>
        ) : (
          (comment.authorName ?? "-")
        ),
    },
    { key: "body", label: "본문" },
    {
      key: "state",
      label: "상태",
      render: (comment) => (comment.isDeleted ? "삭제" : "노출"),
    },
    {
      key: "action",
      label: "관리",
      render: (comment) =>
        comment.isDeleted ? (
          <button
            type="button"
            disabled={comment.restoreUnavailable}
            title={
              comment.restoreUnavailable
                ? "원문이 없어 복구할 수 없습니다."
                : undefined
            }
            onClick={() => setCommentAction({ comment, restore: true })}
          >
            복구
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCommentAction({ comment, restore: false })}
          >
            삭제
          </button>
        ),
    },
  ];

  return (
    <main className={styles.page}>
      <AsyncState loading={!content && !error} error={error}>
        {content ? (
          <>
            <header className={styles.pageHeader}>
              <div>
                <Link href={`/content/${kind}`}>
                  {CONTENT_KIND_LABELS[kind]} 목록
                </Link>
                <h1>{content.title}</h1>
                <div className={styles.statusLine}>
                  <StatusBadge status={content.state} />
                  <span>검색 {content.searchVisible ? "노출" : "제외"}</span>
                </div>
              </div>
              <div className={styles.actions}>
                {content.state !== "deleted" && (
                  <Link href={`/content/${kind}/${id}/edit`}>수정</Link>
                )}
                {content.state === "active" && (
                  <button type="button" onClick={() => setAction("hide")}>
                    숨김
                  </button>
                )}
                {content.state !== "active" && (
                  <button type="button" onClick={() => setAction("restore")}>
                    복구
                  </button>
                )}
                {content.state !== "deleted" && (
                  <button type="button" onClick={() => setAction("delete")}>
                    삭제
                  </button>
                )}
              </div>
            </header>

            <section className={styles.detailSection}>
              <h2>운영 정보</h2>
              <dl className={styles.details}>
                <div>
                  <dt>ID</dt>
                  <dd>{content.id}</dd>
                </div>
                <div>
                  <dt>작성자 ID</dt>
                  <dd>{content.ownerId ?? "-"}</dd>
                </div>
                <div>
                  <dt>조회 / 반응</dt>
                  <dd>
                    {content.views.toLocaleString()} /{" "}
                    {content.likes.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt>생성일</dt>
                  <dd>{formatDate(content.createdAt)}</dd>
                </div>
                <div>
                  <dt>수정일</dt>
                  <dd>{formatDate(content.updatedAt)}</dd>
                </div>
                {content.moderationReason && (
                  <div>
                    <dt>최근 처리 사유</dt>
                    <dd>{content.moderationReason}</dd>
                  </div>
                )}
                <div>
                  <dt>감사 로그</dt>
                  <dd>
                    <Link href={contentAuditLogsHref(kind, id)}>
                      변경 내역 보기
                    </Link>
                  </dd>
                </div>
              </dl>
            </section>

            <section className={styles.detailSection}>
              <h2>콘텐츠</h2>
              <ContentFields data={content.data} />
            </section>

            {supportsReactions && (
              <section className={styles.detailSection}>
                <h2>반응 기록</h2>
                <AsyncState
                  loading={!reactions && !reactionError}
                  error={reactionError}
                >
                  {reactions ? (
                    <>
                      <DataTable
                        caption="콘텐츠 반응 기록"
                        rows={reactions.items}
                        columns={reactionColumns}
                      />
                      {reactions.items.length === 0 && (
                        <p className={styles.empty}>반응 기록이 없습니다.</p>
                      )}
                      {reactions.pagination.totalPages > 1 && (
                        <div className={styles.pager}>
                          <button
                            type="button"
                            disabled={reactionPage === 1}
                            onClick={() => setReactionPage((page) => page - 1)}
                          >
                            이전
                          </button>
                          <span>
                            {reactionPage} / {reactions.pagination.totalPages}
                          </span>
                          <button
                            type="button"
                            disabled={
                              reactionPage === reactions.pagination.totalPages
                            }
                            onClick={() => setReactionPage((page) => page + 1)}
                          >
                            다음
                          </button>
                        </div>
                      )}
                    </>
                  ) : null}
                </AsyncState>
              </section>
            )}

            {parentKind && (
              <section className={styles.detailSection}>
                <h2>댓글·답글</h2>
                <AsyncState
                  loading={!comments && !commentError}
                  error={commentError}
                >
                  {comments ? (
                    <>
                      <DataTable
                        caption="댓글과 답글"
                        rows={comments.items}
                        columns={commentColumns}
                      />
                      {comments.items.length === 0 && (
                        <p className={styles.empty}>댓글이 없습니다.</p>
                      )}
                      {comments.pagination.totalPages > 1 && (
                        <div className={styles.pager}>
                          <button
                            type="button"
                            disabled={commentPage === 1}
                            onClick={() => setCommentPage((page) => page - 1)}
                          >
                            이전
                          </button>
                          <span>
                            {commentPage} / {comments.pagination.totalPages}
                          </span>
                          <button
                            type="button"
                            disabled={
                              commentPage === comments.pagination.totalPages
                            }
                            onClick={() => setCommentPage((page) => page + 1)}
                          >
                            다음
                          </button>
                        </div>
                      )}
                    </>
                  ) : null}
                </AsyncState>
              </section>
            )}
          </>
        ) : null}
      </AsyncState>

      {action && (
        <ReasonDialog
          open
          title={lifecycleLabels[action]}
          onCancel={() => setAction(undefined)}
          onConfirm={runLifecycle}
        />
      )}
      {removingReaction && (
        <ReasonDialog
          open
          title="반응 기록 삭제"
          onCancel={() => setRemovingReaction(undefined)}
          onConfirm={async (reason) => {
            await deleteContentReaction(kind, id, removingReaction.id, reason);
            setRemovingReaction(undefined);
            await loadReactions();
          }}
        />
      )}
      {commentAction && parentKind && (
        <ReasonDialog
          open
          title={`댓글 ${commentAction.restore ? "복구" : "삭제"}`}
          onCancel={() => setCommentAction(undefined)}
          onConfirm={async (reason) => {
            const mutate = commentAction.restore
              ? restoreComment
              : deleteComment;
            await mutate(parentKind, id, commentAction.comment.id, reason);
            setCommentAction(undefined);
            await loadComments();
          }}
        />
      )}
    </main>
  );
}

const lifecycleLabels: Record<LifecycleAction, string> = {
  hide: "콘텐츠 숨김",
  delete: "콘텐츠 삭제",
  restore: "콘텐츠 복구",
};

function ReasonDialog({
  open,
  title,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  return (
    <ConfirmDialog
      open={open}
      title={title}
      onCancel={onCancel}
      confirmDisabled={!reason.trim()}
      validationError={!reason.trim() ? "사유를 입력해주세요." : undefined}
      onConfirm={() => onConfirm(reason.trim())}
    >
      <FormField label="처리 사유">
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required
        />
      </FormField>
    </ConfirmDialog>
  );
}

function ContentFields({ data }: { data: object }) {
  return (
    <dl className={styles.details}>
      {Object.entries(data)
        .filter(([key]) => key !== "kind")
        .map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd className={styles.preserve}>{formatValue(value)}</dd>
          </div>
        ))}
    </dl>
  );
}

function formatValue(value: unknown) {
  if (value == null || value === "") return "-";
  if (Array.isArray(value)) return value.join("\n") || "-";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString("ko-KR") : "-";
}
