import { type NextRequest, NextResponse } from "next/server";
import type { QaComment, Recipe } from "@/domain/community/types";
import type { MyActivityItem } from "@/domain/member/types";
import { publicContentFilter } from "@/infrastructure/mongodb/adminContentMongoRepository";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { upsertRecipeSearchDocument } from "@/infrastructure/mongodb/searchMongoRepository";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { requireContentWriteAllowed } from "@/infrastructure/server/sanctions";
import {
  PROHIBITED_PUBLIC_CONTENT,
  prohibitedPublicContent,
} from "@/infrastructure/server/ugcModeration";
import {
  createId,
  createdAgoNow,
  firstOrFallback,
  nowIso,
} from "@/infrastructure/server/content";
import {
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";
import { scheduleMemberActivityNotification } from "@/infrastructure/server/memberActivityNotifications";

type Params = Promise<{ id: string; commentId: string }>;
type CreateReplyRequest = { body: string; authorName?: string };
type OwnedBTalkComment = QaComment & { ownerId?: string };
type OwnedBTalkPost = Recipe & {
  ownerId?: string;
  comments?: OwnedBTalkComment[];
};

export async function POST(
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
  const { id, commentId } = await params;
  const body = await readJson<CreateReplyRequest>(request);
  const content = requireString(body.body);
  if (!content) return jsonError("답글 내용을 입력해주세요.");
  if (prohibitedPublicContent(content))
    return jsonError(
      PROHIBITED_PUBLIC_CONTENT.message,
      400,
      PROHIBITED_PUBLIC_CONTENT.code,
    );

  const db = await getMongoDb();
  const post = await db
    .collection<OwnedBTalkPost>("community_b_talk")
    .findOne({ $and: [{ id }, publicContentFilter] });
  if (!post) return jsonError("B-TALK 글을 찾을 수 없습니다.", 404);

  const comments = post.comments ?? [];
  const comment = comments.find((item) => item.id === commentId);
  if (!comment) return jsonError("댓글을 찾을 수 없습니다.", 404);
  if (comment.isDeleted)
    return jsonError("삭제된 댓글에는 답글을 달 수 없습니다.", 400);

  const reply: OwnedBTalkComment = {
    id: createId("reply"),
    authorName: user?.name ?? firstOrFallback(body.authorName, "익명"),
    authorAvatarUrl: user.avatarUrl,
    createdAgo: createdAgoNow(),
    createdAt: nowIso(),
    body: content,
    likes: 0,
  };
  if (user) {
    reply.ownerId = user.id;
    reply.isOwner = true;
  }

  const result = await db
    .collection<OwnedBTalkPost>("community_b_talk")
    .updateOne(
      { $and: [{ id, "comments.id": commentId }, publicContentFilter] },
      {
        $push: { "comments.$.replies": reply },
        $inc: { commentCount: 1 },
      },
    );
  if (result.matchedCount === 0)
    return jsonError("B-TALK 글을 찾을 수 없습니다.", 404);
  await upsertRecipeSearchDocument({
    ...post,
    commentCount: (post.commentCount ?? comments.length) + 1,
    comments: comments.map((item) =>
      item.id === commentId
        ? { ...item, replies: [...(item.replies ?? []), reply] }
        : item,
    ),
  });

  if (user) {
    await db
      .collection<MyActivityItem & { ownerId: string }>("member_activities")
      .insertOne({
        ownerId: user.id,
        id: createId("activity"),
        kind: "comment",
        board: "Recipe",
        title: post.title,
        excerpt: content,
        createdAt: reply.createdAt ?? reply.createdAgo,
        href: `/community/b-talk/${post.id.replace(/^recipe-/, "b-talk-")}`,
      });
  }

  const commentOwnerId = (comment as OwnedBTalkComment).ownerId;
  if (user && commentOwnerId) {
    const href = `/community/b-talk/${post.id.replace(/^recipe-/, "b-talk-")}`;
    const body = `${reply.authorName}님이 내 댓글에 답글을 남겼습니다.`;
    scheduleMemberActivityNotification({
      recipientId: commentOwnerId,
      actorId: user.id,
      settingKey: "communityReplies",
      kind: "comment",
      title: body,
      href,
      pushTitle: "새 답글",
      pushBody: body,
    });
  }

  return NextResponse.json(reply, { status: 201 });
}
