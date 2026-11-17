import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import { CouponRedemptionError } from "@/infrastructure/server/couponRedemptionRepository";
import {
  createCouponPresentation,
  cancelCouponPresentation,
  readCouponPresentation,
} from "@/infrastructure/server/couponPresentationRepository";
type Context = { params: Promise<{ userCouponId: string }> };
async function handle(
  request: NextRequest,
  context: Context,
  action: "GET" | "POST" | "DELETE",
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  const { userCouponId } = await context.params;
  try {
    if (action === "POST")
      return NextResponse.json(
        await createCouponPresentation(user.id, userCouponId),
        { headers: { "Cache-Control": "no-store" } },
      );
    if (action === "DELETE") {
      const body = await readJson<{ token?: string }>(request);
      if (
        typeof body.token !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/.test(body.token)
      )
        return jsonError("QR을 확인해 주세요.");
      await cancelCouponPresentation(user.id, userCouponId, body.token);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json(
      await readCouponPresentation(user.id, userCouponId),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof CouponRedemptionError)
      return jsonError(error.message, error.status);
    return jsonError("쿠폰 QR을 처리하지 못했습니다. 다시 시도해 주세요.", 503);
  }
}
export const GET = (r: NextRequest, c: Context) => handle(r, c, "GET");
export const POST = (r: NextRequest, c: Context) => handle(r, c, "POST");
export const DELETE = (r: NextRequest, c: Context) => handle(r, c, "DELETE");
