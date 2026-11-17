import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError } from "@/infrastructure/server/http";
import { recordCurrentUserLastSeen } from "@/infrastructure/server/lastSeen";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  try {
    await recordCurrentUserLastSeen(user.id);
    return NextResponse.json({ success: true });
  } catch {
    return jsonError("잠시 후 다시 시도해주세요.", 500);
  }
}
