import type { NextRequest } from "next/server";
import { DailyNoteMongoRepository } from "@/infrastructure/mongodb/dailyNoteMongoRepository";
import { UserBlockMongoRepository } from "@/infrastructure/mongodb/userBlockMongoRepository";
import { jsonError, readJson } from "@/infrastructure/server/http";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { scheduleMemberActivityNotification } from "@/infrastructure/server/memberActivityNotifications";
import { requireContentWriteAllowed } from "@/infrastructure/server/sanctions";
import { updateContentLike } from "@/infrastructure/server/contentLikes";

type Params = Promise<{ id: string }>;

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
  const body = await readJson<{ liked: unknown }>(request);
  if (typeof body.liked !== "boolean")
    return jsonError("좋아요 상태를 확인해주세요.", 400);
  const { id } = await params;
  const blockedOwnerIds = await new UserBlockMongoRepository().blockedUserIds(
    user.id,
  );
  const note = await new DailyNoteMongoRepository().findById(
    id,
    blockedOwnerIds,
  );
  if (!note) return jsonError("STORY를 찾을 수 없습니다.", 404);
  const result = await updateContentLike(request, {
    collectionName: "community_daily_notes",
    targetType: "community_daily_note",
    targetId: id,
    liked: body.liked,
    countField: "likeCount",
  });
  if (!result) return jsonError("STORY를 찾을 수 없습니다.", 404);
  if (result.changed && body.liked && note.author.id) {
    const message = `${user.handle ?? user.name}님이 내 STORY를 좋아합니다.`;
    scheduleMemberActivityNotification({
      recipientId: note.author.id,
      actorId: user.id,
      settingKey: "communityLikes",
      kind: "like",
      title: message,
      href: `/community/daily-note/${id}`,
      pushTitle: "새 좋아요",
      pushBody: message,
    });
  }
  return Response.json({ liked: result.liked, likeCount: result.likes });
}
