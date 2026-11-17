import type { NextRequest } from "next/server";
import { DailyNoteMongoRepository } from "@/infrastructure/mongodb/dailyNoteMongoRepository";
import { getCurrentUser } from "@/infrastructure/server/auth";
import {
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";
import { requireContentWriteAllowed } from "@/infrastructure/server/sanctions";
import {
  PROHIBITED_PUBLIC_CONTENT,
  prohibitedPublicContent,
} from "@/infrastructure/server/ugcModeration";
import { MAX_DAILY_NOTE_COMMENT_LENGTH } from "../route";

type Params = Promise<{ id: string; commentId: string }>;

const NOT_FOUND_MESSAGE = "댓글을 찾을 수 없습니다.";

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
  const { id, commentId } = await params;
  const updated = await new DailyNoteMongoRepository().updateComment(
    id,
    commentId,
    user.id,
    content,
  );
  if (!updated) return jsonError(NOT_FOUND_MESSAGE, 404);
  return Response.json({ success: true });
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
  const { id, commentId } = await params;
  const deleted = await new DailyNoteMongoRepository().deleteComment(
    id,
    commentId,
    user.id,
  );
  if (!deleted) return jsonError(NOT_FOUND_MESSAGE, 404);
  return Response.json({ success: true });
}
