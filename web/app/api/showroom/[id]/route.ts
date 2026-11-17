import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError } from "@/infrastructure/server/http";
import {
  getCouponsByShowroomId,
  getMenusByShowroomId,
  getShowroomById,
  getShowroomByUserId,
  isStoreFavorited,
} from "@/infrastructure/server/showroomRepository";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import type { MemberProfile } from "@/domain/member/types";
import type { UserCoupon } from "@/domain/showroom/types";
import { canWriteShowroom } from "@/domain/showroom/timesale";
import { canIssueCoupon } from "@/domain/showroom/couponPolicy";

// GET /api/showroom/[id] - 쇼룸 상세 조회
// [id]는 showroomId 또는 barista userId 모두 지원
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await context.params;

  let showroom = await getShowroomById(id);
  if (!showroom) {
    // userId로도 fallback 조회
    showroom = await getShowroomByUserId(id);
  }

  if (!showroom) {
    return jsonError("쇼룸을 찾을 수 없습니다.", 404);
  }

  const [menus, coupons, isFavorited] = await Promise.all([
    getMenusByShowroomId(showroom.id),
    getCouponsByShowroomId(showroom.id),
    isStoreFavorited(user.id, showroom.id),
  ]);

  // 현재 유저가 발급받은 쿠폰 및 여권 조회
  const db = await getMongoDb();
  const [userCoupons, viewerProfile] = await Promise.all([
    db
      .collection<UserCoupon>("user_coupons")
      .find({
        userId: user.id,
        couponId: { $in: coupons.map((c) => c.id) },
      })
      .toArray(),
    db
      .collection<MemberProfile & { ownerId?: string }>("member_profiles")
      .findOne({ ownerId: user.id }, { projection: { passport: 1 } }),
  ]);

  const claimedMap = new Map<string, string>();
  for (const uc of userCoupons) {
    claimedMap.set(uc.couponId, uc.id);
  }

  const couponsWithStatus = coupons
    .filter((coupon) => canIssueCoupon(coupon))
    .map((coupon) => ({
      ...coupon,
      claimed: claimedMap.has(coupon.id),
      userCouponId: claimedMap.get(coupon.id),
      claimedCount: userCoupons.filter(
        (wallet) => wallet.couponId === coupon.id,
      ).length,
    }));

  const isOwner = user.id === showroom.userId && canWriteShowroom(user.role);

  return NextResponse.json({
    showroom,
    menus,
    coupons: couponsWithStatus,
    isOwner,
    isFavorited,
    viewerPassport: viewerProfile?.passport ?? null,
  });
}
