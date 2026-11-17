import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import {
  inspectPassportPresentation,
  PassportError,
} from "@/infrastructure/server/passportRepository";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const body = await readJson<{ token?: unknown; storeId?: unknown }>(request);
  if (typeof body.token !== "string" || !body.token) {
    return jsonError("여권 QR 토큰이 필요합니다.", 400);
  }
  if (typeof body.storeId !== "string" || !body.storeId) {
    return jsonError("처리할 매장을 선택해주세요.", 400);
  }

  try {
    const inspection = await inspectPassportPresentation(
      user.id,
      body.storeId,
      body.token,
    );
    return NextResponse.json(inspection);
  } catch (error) {
    if (error instanceof PassportError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
