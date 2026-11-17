import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError } from "@/infrastructure/server/http";
import {
  NotFoundError,
  approveOwnerCouponUse,
} from "@/infrastructure/server/showroomRepository";
import { ConflictError } from "@/infrastructure/server/timesalePush";

// POST /api/showroom/user-coupons/[userCouponId]/approve - 사장님 승인
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userCouponId: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { userCouponId } = await context.params;

  try {
    const userCoupon = await approveOwnerCouponUse(
      user.id,
      user.role,
      userCouponId,
    );
    return NextResponse.json({ userCoupon }, { status: 200 });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return jsonError(error.message, 404);
    }
    if (error instanceof ConflictError) {
      return jsonError(error.message, 409);
    }
    return jsonError(
      error instanceof Error ? error.message : "쿠폰을 승인하지 못했습니다.",
      400,
    );
  }
}
