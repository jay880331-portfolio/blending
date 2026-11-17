import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import { canWriteShowroom } from "@/domain/showroom/access";
import {
  CouponPolicyError,
  parseCouponDraft,
} from "@/domain/showroom/couponPolicy";
import { createCouponCampaign } from "@/infrastructure/server/couponCampaignRepository";
import { getShowroomByUserId } from "@/infrastructure/server/showroomRepository";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  if (!canWriteShowroom(user.role))
    return jsonError("바리스타만 쿠폰을 등록할 수 있습니다.", 403);
  try {
    const draft = parseCouponDraft(
      await readJson<Record<string, unknown>>(request),
    );
    const showroom = await getShowroomByUserId(user.id);
    if (!showroom) return jsonError("먼저 쇼룸을 개설해 주세요.", 400);
    const coupon = await createCouponCampaign(draft, showroom);
    return NextResponse.json({ coupon }, { status: 201 });
  } catch (error) {
    if (error instanceof CouponPolicyError)
      return jsonError(error.message, error.status);
    return jsonError(
      "쿠폰을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      503,
    );
  }
}
