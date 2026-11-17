import { type NextRequest, NextResponse } from "next/server";
import type { QaComment, QaPost } from "@/domain/community/types";
import { publicContentFilter } from "@/infrastructure/mongodb/adminContentMongoRepository";
import { isContentOwner } from "@/infrastructure/server/contentOwnership";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { upsertQaSearchDocument } from "@/infrastructure/mongodb/searchMongoRepository";
import {
  getCurrentAdminUser,
  getCurrentUser,
} from "@/infrastructure/server/auth";
import { requireContentWriteAllowed } from "@/infrastructure/server/sanctions";
import {
  PROHIBITED_PUBLIC_CONTENT,
  prohibitedPublicContent,
} from "@/infrastructure/server/ugcModeration";
import {
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";

type Params = Promise<{ id: string; commentId: string }>;
type OwnedQaComment = QaComment & { ownerId?: string };
type OwnedQaPost = QaPost & { comments: OwnedQaComment[] };

type UpdateCommentRequest = {
  body: string;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Params },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  try {
    await requireContentWriteAllowed(user.id);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "작성할 수 없습니다.",
      403,
    );
  }
  const isAdmin = Boolean(await getCurrentAdminUser(request));
  const { id, commentId } = await params;
  const db = await getMongoDb();
  const post = await db
    .collection<OwnedQaPost>("community_qa_posts")
    .findOne({ $and: [{ id }, publicContentFilter] });
  if (!post) return jsonError("질문을 찾을 수 없습니다.", 404);

  const found = findComment(post.comments, commentId);
  const comment = found?.comment;
  if (!comment) return jsonError("댓글을 찾을 수 없습니다.", 404);
  if (comment.isDeleted) return jsonError("삭제된 댓글입니다.", 400);
  if (!isAdmin && !isOwner(comment, user))
    return jsonError("댓글을 수정할 권한이 없습니다.", 403);

  const body = await readJson<UpdateCommentRequest>(request);
  const content = requireString(body.body);
  if (!content) return jsonError("댓글 내용을 입력해주세요.");
  if (prohibitedPublicContent(content))
    return jsonError(
      PROHIBITED_PUBLIC_CONTENT.message,
      400,
      PROHIBITED_PUBLIC_CONTENT.code,
    );

  const result = await db
    .collection<OwnedQaPost>("community_qa_posts")
    .updateOne(
      found.nested
        ? {
            $and: [
              { id, "comments.replies.id": commentId },
              publicContentFilter,
            ],
          }
        : { $and: [{ id, "comments.id": commentId }, publicContentFilter] },
      {
        $set: {
          [found.nested
            ? "comments.$[parent].replies.$[reply].body"
            : "comments.$.body"]: content,
        },
      },
      found.nested
        ? {
            arrayFilters: [
              { "parent.replies.id": commentId },
              { "reply.id": commentId },
            ],
          }
        : undefined,
    );
  if (result.matchedCount === 0)
    return jsonError("질문을 찾을 수 없습니다.", 404);
  await upsertQaSearchDocument({
    ...post,
    comments: updateCommentBody(post.comments, commentId, content),
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  try {
    await requireContentWriteAllowed(user.id);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "작성할 수 없습니다.",
      403,
    );
  }
  const isAdmin = Boolean(await getCurrentAdminUser(request));
  const { id, commentId } = await params;
  const db = await getMongoDb();
  const post = await db
    .collection<OwnedQaPost>("community_qa_posts")
    .findOne({ $and: [{ id }, publicContentFilter] });
  if (!post) return jsonError("질문을 찾을 수 없습니다.", 404);

  const found = findComment(post.comments, commentId);
  const comment = found?.comment;
  if (!comment) return jsonError("댓글을 찾을 수 없습니다.", 404);
  if (comment.isDeleted) return NextResponse.json({ success: true });
  if (!isAdmin && !isOwner(comment, user))
    return jsonError("댓글을 삭제할 권한이 없습니다.", 403);

  const commentPath = found.nested
    ? "comments.$[parent].replies.$[reply]"
    : "comments.$";
  const result = await db
    .collection<OwnedQaPost>("community_qa_posts")
    .updateOne(
      found.nested
        ? {
            $and: [
              { id, "comments.replies.id": commentId },
              publicContentFilter,
            ],
          }
        : { $and: [{ id, "comments.id": commentId }, publicContentFilter] },
      {
        $set: {
          [`${commentPath}.isDeleted`]: true,
          [`${commentPath}.deletedAt`]: new Date().toISOString(),
          [`${commentPath}.deletedBy`]: user.id,
        },
      },
      found.nested
        ? {
            arrayFilters: [
              { "parent.replies.id": commentId },
              { "reply.id": commentId },
            ],
          }
        : undefined,
    );
  if (result.matchedCount === 0)
    return jsonError("질문을 찾을 수 없습니다.", 404);
  await upsertQaSearchDocument({
    ...post,
    comments: markCommentDeleted(post.comments, commentId),
  });

  return NextResponse.json({ success: true });
}

function isOwner(
  comment: Pick<OwnedQaComment, "ownerId" | "authorName">,
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
) {
  return isContentOwner(comment.ownerId, user.id);
}

function findComment(comments: OwnedQaComment[], commentId: string) {
  for (const comment of comments) {
    if (comment.id === commentId) return { comment, nested: false };
    const reply = comment.replies?.find((item) => item.id === commentId) as
      | OwnedQaComment
      | undefined;
    if (reply) return { comment: reply, nested: true };
  }
}

function updateCommentBody(
  comments: OwnedQaComment[],
  commentId: string,
  body: string,
): OwnedQaComment[] {
  return comments.map((comment) =>
    comment.id === commentId
      ? { ...comment, body }
      : {
          ...comment,
          replies: comment.replies
            ? updateCommentBody(
                comment.replies as OwnedQaComment[],
                commentId,
                body,
              )
            : comment.replies,
        },
  );
}

function markCommentDeleted(
  comments: OwnedQaComment[],
  commentId: string,
): OwnedQaComment[] {
  return comments.map((comment) =>
    comment.id === commentId
      ? {
          ...comment,
          authorName: "댓글 작성자",
          body: "삭제된 댓글이에요.",
          isDeleted: true,
        }
      : {
          ...comment,
          replies: comment.replies
            ? markCommentDeleted(comment.replies as OwnedQaComment[], commentId)
            : comment.replies,
        },
  );
}
