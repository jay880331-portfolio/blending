import { type NextRequest, NextResponse } from "next/server";
import type { QaComment, QaPost } from "@/domain/community/types";
import type { MyActivityItem } from "@/domain/member/types";
import { publicContentFilter } from "@/infrastructure/mongodb/adminContentMongoRepository";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { upsertQaSearchDocument } from "@/infrastructure/mongodb/searchMongoRepository";
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
import { getCurrentUser } from "@/infrastructure/server/auth";
import { requireContentWriteAllowed } from "@/infrastructure/server/sanctions";
import {
  PROHIBITED_PUBLIC_CONTENT,
  prohibitedPublicContent,
} from "@/infrastructure/server/ugcModeration";
import { scheduleMemberActivityNotification } from "@/infrastructure/server/memberActivityNotifications";

type Params = Promise<{ id: string }>;

type CreateCommentRequest = {
  body: string;
  authorName?: string;
};

type OwnedQaComment = QaComment & { ownerId?: string };
type OwnedQaPost = QaPost & { ownerId?: string };

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
  const { id } = await params;
  const body = await readJson<CreateCommentRequest>(request);
  const content = requireString(body.body);
  if (!content) return jsonError("댓글 내용을 입력해주세요.");
  if (prohibitedPublicContent(content))
    return jsonError(
      PROHIBITED_PUBLIC_CONTENT.message,
      400,
      PROHIBITED_PUBLIC_CONTENT.code,
    );

  const comment: OwnedQaComment = {
    id: createId("comment"),
    authorName: user?.name ?? firstOrFallback(body.authorName, "익명"),
    authorAvatarUrl: user.avatarUrl,
    createdAgo: createdAgoNow(),
    createdAt: nowIso(),
    body: content,
    likes: 0,
  };
  if (user) {
    comment.ownerId = user.id;
    comment.isOwner = true;
  }

  const db = await getMongoDb();
  const post = await db
    .collection<OwnedQaPost>("community_qa_posts")
    .findOne({ $and: [{ id }, publicContentFilter] });
  if (!post) return jsonError("질문을 찾을 수 없습니다.", 404);
  const result = await db.collection<QaPost>("community_qa_posts").updateOne(
    { $and: [{ id }, publicContentFilter] },
    {
      $push: { comments: comment },
      $inc: { commentCount: 1 },
    },
  );

  if (result.matchedCount === 0)
    return jsonError("질문을 찾을 수 없습니다.", 404);
  await upsertQaSearchDocument({
    ...post,
    commentCount: post.commentCount + 1,
    comments: [...post.comments, comment],
  });

  if (user) {
    await db
      .collection<MyActivityItem & { ownerId: string }>("member_activities")
      .insertOne({
        ownerId: user.id,
        id: createId("activity"),
        kind: "comment",
        board: "Q&A",
        title: post.title,
        excerpt: content,
        createdAt: comment.createdAt ?? comment.createdAgo,
        href: `/community/qa/${post.id}`,
      });
  }

  if (user && post.ownerId) {
    const body = `${comment.authorName}님이 내 질문에 댓글을 남겼습니다.`;
    scheduleMemberActivityNotification({
      recipientId: post.ownerId,
      actorId: user.id,
      settingKey: "communityComments",
      kind: "comment",
      title: body,
      href: `/community/qa/${post.id}`,
      pushTitle: "새 댓글",
      pushBody: body,
    });
  }

  return NextResponse.json(comment, { status: 201 });
}
