import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError } from "@/infrastructure/server/http";
import { getPassportSummary } from "@/infrastructure/server/passportRepository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const summary = await getPassportSummary(user.id);
  return NextResponse.json(summary, {
    headers: { "Cache-Control": "no-store" },
  });
}
