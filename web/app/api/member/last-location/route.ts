import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import { upsertMemberLastLocation } from "@/infrastructure/server/showroomRepository";

// POST /api/member/last-location - 유저 최근 위치 갱신
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  type LocationPayload = {
    latitude?: number;
    longitude?: number;
  };

  const body = await readJson<LocationPayload>(request);
  if (typeof body.latitude !== "number" || typeof body.longitude !== "number") {
    return jsonError("올바른 위도(latitude)와 경도(longitude)를 입력해주세요.");
  }

  await upsertMemberLastLocation(user.id, body.latitude, body.longitude);
  return NextResponse.json({ success: true });
}
