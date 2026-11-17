import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError } from "@/infrastructure/server/http";
import { listMemberReservations } from "@/infrastructure/server/beanReservationRepository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const reservations = await listMemberReservations(user.id);
  return NextResponse.json(
    { reservations },
    { headers: { "Cache-Control": "no-store" } },
  );
}
