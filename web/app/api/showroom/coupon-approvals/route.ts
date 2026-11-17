import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { canWriteShowroom } from "@/domain/showroom/access";
import { CouponPolicyError } from "@/domain/showroom/couponPolicy";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { getShowroomByUserId } from "@/infrastructure/server/showroomRepository";
import {
  decideCouponCampaign,
  listCouponApprovals,
} from "@/infrastructure/server/couponCampaignRepository";
import { jsonError, readJson } from "@/infrastructure/server/http";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  if (!canWriteShowroom(user.role))
    return jsonError("바리스타 전용 기능입니다.", 403);
  return NextResponse.json(
    {
      requests: await listCouponApprovals(user.id, user.role!),
      isAdmin: user.role === "admin",
      reviewerId: user.id,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  if (!canWriteShowroom(user.role))
    return jsonError("바리스타 전용 기능입니다.", 403);
  try {
    const body = await readJson<{
      action?: string;
      couponId?: string;
      storeId?: string;
      accept?: boolean;
    }>(request);
    if (body.action === "join-network" && body.accept === true) {
      const showroom = await getShowroomByUserId(user.id);
      if (!showroom) return jsonError("쇼룸을 먼저 개설해 주세요.", 400);
      const db = await getMongoDb();
      await db
        .collection("barista_showrooms")
        .updateOne(
          { id: showroom.id, platformCouponsAcceptedAt: { $exists: false } },
          { $set: { platformCouponsAcceptedAt: new Date().toISOString() } },
        );
      return NextResponse.json({ success: true });
    }
    if (
      body.action !== "decide" ||
      typeof body.couponId !== "string" ||
      typeof body.storeId !== "string" ||
      typeof body.accept !== "boolean"
    )
      return jsonError("승인 요청을 확인해 주세요.", 400);
    const coupon = await decideCouponCampaign(
      user.id,
      user.role!,
      body.couponId,
      body.storeId,
      body.accept,
    );
    return NextResponse.json({ coupon });
  } catch (error) {
    if (error instanceof CouponPolicyError)
      return jsonError(error.message, error.status);
    return jsonError("요청을 처리하지 못했습니다. 다시 시도해 주세요.", 503);
  }
}
