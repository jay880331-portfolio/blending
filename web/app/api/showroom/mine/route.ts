import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError } from "@/infrastructure/server/http";
import {
  getCouponsByShowroomId,
  getMenusByShowroomId,
  getShowroomByUserId,
  listNoticeManageStores,
} from "@/infrastructure/server/showroomRepository";
import {
  canWriteShowroom,
  showroomWriteForbiddenMessage,
} from "@/domain/showroom/timesale";

// GET /api/showroom/mine - 내 쇼룸 조회
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  if (!canWriteShowroom(user.role)) {
    return jsonError(showroomWriteForbiddenMessage(), 403);
  }

  const [showroom, noticeStores] = await Promise.all([
    getShowroomByUserId(user.id, { includeBusinessNumber: true }),
    listNoticeManageStores(user.id),
  ]);
  if (!showroom) {
    return NextResponse.json({
      showroom: null,
      menus: [],
      coupons: [],
      noticeStores,
    });
  }

  const [menus, coupons] = await Promise.all([
    getMenusByShowroomId(showroom.id),
    getCouponsByShowroomId(showroom.id),
  ]);

  return NextResponse.json({
    showroom,
    menus,
    coupons,
    isOwner: true,
    noticeStores,
  });
}
