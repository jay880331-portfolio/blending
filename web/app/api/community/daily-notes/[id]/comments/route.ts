import type { NextRequest } from "next/server";
import type { DailyNoteComment } from "@/domain/daily-note/dailyNote";
import {
  DailyNoteMongoRepository,
  toPublicDailyNoteComment,
} from "@/infrastructure/mongodb/dailyNoteMongoRepository";
import { UserBlockMongoRepository } from "@/infrastructure/mongodb/userBlockMongoRepository";
import { getCurrentUser } from "@/infrastructure/server/auth";
import {
  createId,
  createdAgoNow,
  nowIso,
} from "@/infrastructure/server/content";
import {
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";
import { scheduleMemberActivityNotification } from "@/infrastructure/server/memberActivityNotifications";
import { requireContentWriteAllowed } from "@/infrastructure/server/sanctions";
import {
  PROHIBITED_PUBLIC_CONTENT,
  prohibitedPublicContent,
} from "@/infrastructure/server/ugcModeration";

type Params = Promise<{ id: string }>;
export const MAX_DAILY_NOTE_COMMENT_LENGTH = 1000;

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
  const body = await readJson<{ body: string }>(request);
  const content = requireString(body.body);
  if (!content) return jsonError("댓글 내용을 입력해주세요.");
  if (content.length > MAX_DAILY_NOTE_COMMENT_LENGTH)
    return jsonError("댓글은 1,000자 이하로 입력해주세요.", 400);
  if (prohibitedPublicContent(content))
    return jsonError(
      PROHIBITED_PUBLIC_CONTENT.message,
      400,
      PROHIBITED_PUBLIC_CONTENT.code,
    );
  const { id } = await params;
  const blockedOwnerIds = await new UserBlockMongoRepository().blockedUserIds(
    user.id,
  );
  const comment: DailyNoteComment & { ownerId: string } = {
    id: createId("comment"),
    ownerId: user.id,
    authorId: user.id,
    authorName: user.handle ?? user.name,
    authorAvatarUrl: user.avatarUrl,
    createdAgo: createdAgoNow(),
    createdAt: nowIso(),
    body: content,
    likes: 0,
  };
  const result = await new DailyNoteMongoRepository().addComment(
    id,
    comment,
    blockedOwnerIds,
  );
  if (result.status === "not-found")
    return jsonError("STORY를 찾을 수 없습니다.", 404);
  if (result.status === "limit-reached")
    return jsonError("댓글 수가 최대 1,000개에 도달했습니다.", 409);
  if (result.note.author.id) {
    const message = `${comment.authorName}님이 내 STORY에 댓글을 남겼습니다.`;
    scheduleMemberActivityNotification({
      recipientId: result.note.author.id,
      actorId: user.id,
      settingKey: "communityComments",
      kind: "comment",
      title: message,
      href: `/community/daily-note/${id}`,
      pushTitle: "새 댓글",
      pushBody: message,
    });
  }
  return Response.json(toPublicDailyNoteComment(comment, user.id), {
    status: 201,
  });
}
