import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import {
  getCouponById,
  getShowroomByUserId,
} from "@/infrastructure/server/showroomRepository";
import {
  ConflictError,
  sendTimesalePush,
  findTimesaleRecipientUserIds,
  readCouponPushRun,
} from "@/infrastructure/server/timesalePush";
import { canIssueCoupon } from "@/domain/showroom/couponPolicy";
import {
  canWriteShowroom,
  showroomWriteForbiddenMessage,
} from "@/domain/showroom/timesale";

// POST /api/showroom/coupons/[couponId]/timesale-push - 타임세일 푸시 발송
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ couponId: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  if (!canWriteShowroom(user.role)) {
    return jsonError(showroomWriteForbiddenMessage(), 403);
  }

  const { couponId } = await context.params;

  const [showroom, coupon] = await Promise.all([
    getShowroomByUserId(user.id),
    getCouponById(couponId),
  ]);

  if (!showroom) {
    return jsonError("바리스타 쇼룸을 찾을 수 없습니다.", 404);
  }

  if (!coupon || coupon.showroomId !== showroom.id) {
    return jsonError("해당 쇼룸의 쿠폰을 찾을 수 없습니다.", 404);
  }

  if (coupon.couponType !== "timesale") {
    return jsonError("타임세일 쿠폰만 푸시를 발송할 수 있습니다.", 400);
  }

  type PushPayload = {
    customTitle?: string;
    customBody?: string;
    audience?: "regulars" | "nearby" | "both";
    preview?: boolean;
  };

  const body = (await readJson<PushPayload>(request).catch(
    () => ({}),
  )) as Partial<PushPayload>;
  if (
    (body.preview != null && typeof body.preview !== "boolean") ||
    (body.customTitle != null &&
      (typeof body.customTitle !== "string" || body.customTitle.length > 60)) ||
    (body.customBody != null &&
      (typeof body.customBody !== "string" || body.customBody.length > 200)) ||
    (body.audience != null &&
      !["regulars", "nearby", "both"].includes(body.audience))
  )
    return jsonError("알림 내용을 확인해 주세요.", 400);
  if (!canIssueCoupon(coupon))
    return jsonError("발급 가능한 쿠폰만 알림을 보낼 수 있습니다.", 409);

  try {
    if (body.preview === true) {
      const ids = await findTimesaleRecipientUserIds({
        baristaId: showroom.userId,
        storeLocation: showroom.location,
        audience: body.audience,
      });
      return NextResponse.json({ recipientCount: ids.length });
    }
    const result = await sendTimesalePush({
      showroom,
      coupon,
      customTitle: body.customTitle,
      customBody: body.customBody,
      audience: body.audience,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ConflictError) {
      return jsonError(error.message, 409);
    }
    return jsonError("푸시 발송 중 오류가 발생했습니다.", 503);
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ couponId: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  const { couponId } = await context.params;
  const coupon = await getCouponById(couponId);
  if (!canWriteShowroom(user.role) || coupon?.baristaId !== user.id)
    return jsonError("쿠폰을 찾을 수 없습니다.", 404);
  try {
    return NextResponse.json(
      { run: await readCouponPushRun(user.id, couponId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return jsonError("발송 결과를 확인하지 못했습니다.", 503);
  }
}
