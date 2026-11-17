import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import {
  BrewGuideError,
  createBrewGuide,
  listAuthorizedStoresForBrewGuide,
} from "@/infrastructure/server/brewGuideRepository";
import { jsonError, readJson } from "@/infrastructure/server/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  if (request.nextUrl.searchParams.get("eligibleStores") === "1") {
    const stores = await listAuthorizedStoresForBrewGuide(user.id);
    return NextResponse.json({ stores });
  }

  return jsonError("잘못된 요청입니다.", 400);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const body = await readJson<Record<string, unknown>>(request);
  if (!body || typeof body !== "object") {
    return jsonError("요청 본문이 올바르지 않습니다.", 400);
  }
  const storeId = typeof body.storeId === "string" ? body.storeId.trim() : "";

  try {
    const guide = await createBrewGuide(user.id, storeId, body);
    return NextResponse.json({ guide }, { status: 201 });
  } catch (error) {
    if (error instanceof BrewGuideError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
