import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  setLikeIdentityCookie,
  updateEmbeddedCommentLike,
} from "@/infrastructure/server/contentLikes";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import { scheduleMemberActivityNotification } from "@/infrastructure/server/memberActivityNotifications";
import { requireContentWriteAllowed } from "@/infrastructure/server/sanctions";

type CommentLikeTargetType =
  | "community_qa_comment"
  | "community_b_talk_comment"
  | "community_daily_note_comment";

export async function postEmbeddedCommentLike(
  request: NextRequest,
  input: {
    parentId: string;
    commentId: string;
    collectionName: string;
    targetType: CommentLikeTargetType;
    notFoundMessage: string;
    href: string;
  },
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

  const body = await readJson<{ liked: unknown }>(request);
  if (typeof body.liked !== "boolean")
    return jsonError("좋아요 상태를 확인해주세요.", 400);

  const result = await updateEmbeddedCommentLike(request, {
    collectionName: input.collectionName,
    targetType: input.targetType,
    parentId: input.parentId,
    commentId: input.commentId,
    liked: body.liked,
  });
  if (!result) return jsonError(input.notFoundMessage, 404);

  if (result.changed && body.liked && result.commentOwnerId) {
    scheduleMemberActivityNotification({
      recipientId: result.commentOwnerId,
      actorId: user.id,
      settingKey: "communityLikes",
      kind: "like",
      title: `${user.handle ?? user.name}님이 내 댓글을 좋아합니다.`,
      href: input.href,
      pushTitle: "새 좋아요",
      pushBody: `${user.handle ?? user.name}님이 내 댓글을 좋아합니다.`,
    });
  }

  const response = NextResponse.json({
    likes: result.likes,
    liked: result.liked,
  });
  setLikeIdentityCookie(response, result.visitorId);
  return response;
}
