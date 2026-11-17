import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError } from "@/infrastructure/server/http";
import {
  NotFoundError,
  listOwnerCouponRequests,
} from "@/infrastructure/server/showroomRepository";
import { ConflictError } from "@/infrastructure/server/timesalePush";

// GET /api/showroom/coupon-requests - 사장님 대기 목록 조회
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  try {
    const result = await listOwnerCouponRequests(user.id, user.role);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return jsonError(error.message, 404);
    }
    if (error instanceof ConflictError) {
      return jsonError(error.message, 409);
    }
    return jsonError(
      error instanceof Error
        ? error.message
        : "쿠폰 요청 목록을 불러오지 못했습니다.",
      400,
    );
  }
}
