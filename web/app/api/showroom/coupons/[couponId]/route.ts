import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError } from "@/infrastructure/server/http";
import { deleteCoupon } from "@/infrastructure/server/showroomRepository";
import {
  canWriteShowroom,
  showroomWriteForbiddenMessage,
} from "@/domain/showroom/timesale";

// DELETE /api/showroom/coupons/[couponId] - 추가 발급 중단
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ couponId: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  if (!canWriteShowroom(user.role)) {
    return jsonError(showroomWriteForbiddenMessage(), 403);
  }

  const { couponId } = await context.params;
  const deleted = await deleteCoupon(user.id, couponId);
  if (!deleted) {
    return jsonError("쿠폰을 찾을 수 없거나 발급 중단 권한이 없습니다.", 404);
  }

  return NextResponse.json({ success: true });
}
