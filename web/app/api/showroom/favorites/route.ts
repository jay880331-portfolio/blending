import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError } from "@/infrastructure/server/http";
import { listStoreFavorites } from "@/infrastructure/server/showroomRepository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const favorites = await listStoreFavorites(user.id);
  return NextResponse.json(
    { favorites },
    { headers: { "Cache-Control": "no-store" } },
  );
}
