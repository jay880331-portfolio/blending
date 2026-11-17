import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import {
  deleteMenu,
  updateMenuExchangePoints,
} from "@/infrastructure/server/showroomRepository";
import {
  canWriteShowroom,
  showroomWriteForbiddenMessage,
} from "@/domain/showroom/timesale";
import { validateExchangePoints } from "@/domain/passport/ledger";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ menuId: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  if (!canWriteShowroom(user.role)) {
    return jsonError(showroomWriteForbiddenMessage(), 403);
  }

  const body = await readJson<{ exchangePoints?: unknown }>(request);
  const parsed = validateExchangePoints(body.exchangePoints);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  const { menuId } = await context.params;
  const menu = await updateMenuExchangePoints(user.id, menuId, parsed.points);
  if (!menu) {
    return jsonError("메뉴를 찾을 수 없거나 수정 권한이 없습니다.", 404);
  }

  return NextResponse.json({ menu });
}

// DELETE /api/showroom/menus/[menuId] - 메뉴 삭제
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ menuId: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  if (!canWriteShowroom(user.role)) {
    return jsonError(showroomWriteForbiddenMessage(), 403);
  }

  const { menuId } = await context.params;
  const deleted = await deleteMenu(user.id, menuId);
  if (!deleted) {
    return jsonError("메뉴를 찾을 수 없거나 삭제 권한이 없습니다.", 404);
  }

  return NextResponse.json({ success: true });
}
