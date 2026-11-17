import { type NextRequest, NextResponse, after } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import { canWriteShowroom } from "@/domain/showroom/access";
import { CouponRedemptionError } from "@/infrastructure/server/couponRedemptionRepository";
import {
  inspectPresentedCoupon,
  redeemPresentedCoupon,
  listCouponStaffStores,
} from "@/infrastructure/server/couponPresentationRepository";
import { sendPushNotification } from "@/infrastructure/server/pushNotifications";
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  if (!canWriteShowroom(user.role))
    return jsonError("직원 전용 기능입니다.", 403);
  try {
    return NextResponse.json(
      { stores: await listCouponStaffStores(user.id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return jsonError("처리 가능한 매장을 불러오지 못했습니다.", 503);
  }
}
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  if (!canWriteShowroom(user.role))
    return jsonError("직원 전용 기능입니다.", 403);
  const body = await readJson<{
    token?: string;
    storeId?: string;
    action?: string;
  }>(request);
  if (
    typeof body.token !== "string" ||
    typeof body.storeId !== "string" ||
    body.storeId.length < 1 ||
    body.storeId.length > 100 ||
    body.token.length !== 43 ||
    !["inspect", "redeem"].includes(body.action ?? "")
  )
    return jsonError("고객 QR과 처리 매장을 확인해 주세요.");
  try {
    if (body.action === "inspect") {
      const { coupon, store } = await inspectPresentedCoupon(
        user.id,
        body.storeId,
        body.token,
      );
      return NextResponse.json(
        { coupon, store: { id: store.id, storeName: store.storeName } },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const result = await redeemPresentedCoupon(
      user.id,
      body.storeId,
      body.token,
    );
    if (result.newlyUsed)
      after(async () => {
        await sendPushNotification(result.userCoupon.userId, {
          title: "쿠폰 사용 완료",
          body: `${result.store.storeName} · ${result.coupon.discountDetail}`,
          data: { href: "/showroom/coupons" },
        });
      });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof CouponRedemptionError)
      return jsonError(error.message, error.status);
    return jsonError(
      "처리 결과를 확인하지 못했습니다. 같은 QR로 다시 확인해 주세요.",
      503,
    );
  }
}
