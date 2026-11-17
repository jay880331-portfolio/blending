import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import { canWriteShowroom } from "@/domain/showroom/access";
import { CouponRedemptionError } from "@/infrastructure/server/couponRedemptionRepository";
import {
  listCouponStaff,
  manageCouponStaff,
} from "@/infrastructure/server/couponPresentationRepository";
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  if (!canWriteShowroom(user.role))
    return jsonError("관리자 전용 기능입니다.", 403);
  try {
    return NextResponse.json(
      { staff: await listCouponStaff(user.id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return jsonError("직원을 불러오지 못했습니다.", 503);
  }
}
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  if (!canWriteShowroom(user.role))
    return jsonError("관리자 전용 기능입니다.", 403);
  const body = await readJson<{
    phone?: string;
    userId?: string;
    revoke?: boolean;
  }>(request);
  if (body.revoke !== undefined && typeof body.revoke !== "boolean")
    return jsonError("요청을 확인해 주세요.");
  if (!body.revoke) {
    return jsonError(
      "전화번호 직접 등록은 종료되었습니다. 직원의 가입 신청을 승인해 주세요.",
      410,
    );
  }
  if (typeof body.userId !== "string" || body.userId.length > 100)
    return jsonError("직원 계정을 확인해 주세요.");
  try {
    return NextResponse.json(await manageCouponStaff(user.id, body));
  } catch (error) {
    if (error instanceof CouponRedemptionError)
      return jsonError(error.message, error.status);
    return jsonError("직원 권한을 변경하지 못했습니다.", 503);
  }
}
