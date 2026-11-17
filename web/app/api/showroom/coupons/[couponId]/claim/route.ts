import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import { CouponPolicyError } from "@/domain/showroom/couponPolicy";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { ensureCouponClaimIndexes } from "@/infrastructure/mongodb/couponIndexes";
import {
  claimCoupon,
  NotFoundError,
} from "@/infrastructure/server/showroomRepository";

// POST /api/showroom/coupons/[couponId]/claim - 쿠폰 담기
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ couponId: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { couponId } = await context.params;

  try {
    await ensureMongoIndexes();
    await ensureCouponClaimIndexes(await getMongoDb());
    const body = await readJson<{ requestId?: string }>(request);
    if (body.requestId != null && typeof body.requestId !== "string")
      return jsonError("요청 번호를 확인해 주세요.", 400);
    const userCoupon = await claimCoupon(user.id, couponId, body.requestId);
    return NextResponse.json({ userCoupon }, { status: 200 });
  } catch (error) {
    if (error instanceof CouponPolicyError)
      return jsonError(error.message, error.status);
    if (error instanceof NotFoundError) {
      return jsonError(error.message, 404);
    }
    return jsonError(
      error instanceof Error ? error.message : "쿠폰을 담지 못했습니다.",
      400,
    );
  }
}
