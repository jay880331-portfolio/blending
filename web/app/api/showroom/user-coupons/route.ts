import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError } from "@/infrastructure/server/http";
import {
  getUserCoupons,
  listJoinedShowrooms,
} from "@/infrastructure/server/showroomRepository";

// GET /api/showroom/user-coupons - 유저 쿠폰함 조회
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const [userCoupons, joinedShowrooms] = await Promise.all([
    getUserCoupons(user.id),
    listJoinedShowrooms(user.id),
  ]);
  return NextResponse.json({ userCoupons, joinedShowrooms });
}
