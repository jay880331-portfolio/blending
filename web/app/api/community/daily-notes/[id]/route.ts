import type { NextRequest } from "next/server";
import type { DailyNote, DailyNoteInput } from "@/domain/daily-note/dailyNote";
import { validateDailyNoteCreateRequest } from "@/application/daily-note/dailyNoteCreateRequest";
import { DailyNoteMongoRepository } from "@/infrastructure/mongodb/dailyNoteMongoRepository";
import { UserBlockMongoRepository } from "@/infrastructure/mongodb/userBlockMongoRepository";
import { getCurrentUser } from "@/infrastructure/server/auth";
import {
  getLikeIdentity,
  likedTargetIds,
} from "@/infrastructure/server/contentLikes";
import { jsonError, readJson } from "@/infrastructure/server/http";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { requireContentWriteAllowed } from "@/infrastructure/server/sanctions";

type Params = Promise<{ id: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  const { id } = await params;
  const blockedOwnerIds = await new UserBlockMongoRepository().blockedUserIds(
    user.id,
  );
  const note = await new DailyNoteMongoRepository().findById(
    id,
    blockedOwnerIds,
    user.id,
  );
  if (!note) return jsonError("STORY를 찾을 수 없습니다.", 404);
  const identity = await getLikeIdentity(request);
  const db = await getMongoDb();
  const commentIds = (note.comments ?? []).map((comment) => comment.id);
  const [likedIds, likedCommentIds] = await Promise.all([
    likedTargetIds(db, {
      identityKey: identity?.key,
      targetType: "community_daily_note",
      targetIds: [id],
    }),
    likedTargetIds(db, {
      identityKey: identity?.key,
      targetType: "community_daily_note_comment",
      targetIds: commentIds,
    }),
  ]);
  const liked = likedIds.has(id);
  const isOwner = Boolean(note.isOwner);
  return Response.json(
    {
      ...note,
      liked,
      isOwner,
      canManage: isOwner,
      comments: (note.comments ?? []).map((comment) => ({
        ...comment,
        liked: likedCommentIds.has(comment.id),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

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

  const body = await readJson<DailyNoteInput>(request);
  const validated = validateDailyNoteCreateRequest(body, user.id);
  if (typeof validated === "string") return jsonError(validated);
  const { id } = await params;
  const location = body.location as DailyNote["location"] | undefined;
  const updated = await new DailyNoteMongoRepository().update(id, user.id, {
    ...validated,
    ...(location
      ? {
          location: {
            name: location.name.trim(),
            address: location.address.trim(),
          },
        }
      : {}),
  });
  if (!updated) return jsonError("STORY를 찾을 수 없습니다.", 404);
  return Response.json({ ...updated, isOwner: true, canManage: true });
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

  const { id } = await params;
  if (!(await new DailyNoteMongoRepository().delete(id, user.id)))
    return jsonError("STORY를 찾을 수 없습니다.", 404);
  return Response.json({ success: true });
}
