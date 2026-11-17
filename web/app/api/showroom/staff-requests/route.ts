import { type NextRequest, NextResponse } from "next/server";
import { canWriteShowroom } from "@/domain/showroom/access";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import {
  listMyStaffRequests,
  listStoreStaffRequests,
  requestStaffJoin,
  StaffRequestError,
} from "@/infrastructure/server/staffRequestRepository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  if (!canWriteShowroom(user.role)) {
    return jsonError("바리스타 전용 기능입니다.", 403);
  }

  const scope = request.nextUrl.searchParams.get("scope");
  const requests =
    scope === "my"
      ? await listMyStaffRequests(user.id)
      : await listStoreStaffRequests(user.id);

  return NextResponse.json(
    { requests },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const body = await readJson<{ storeId?: unknown }>(request);
  const storeId = typeof body?.storeId === "string" ? body.storeId.trim() : "";
  if (!storeId) {
    return jsonError("신청할 매장을 선택해주세요.", 400);
  }

  try {
    const created = await requestStaffJoin(user.id, storeId);
    return NextResponse.json({ request: created }, { status: 201 });
  } catch (error) {
    if (error instanceof StaffRequestError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
