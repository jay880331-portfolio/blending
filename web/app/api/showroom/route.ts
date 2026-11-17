import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import {
  getShowrooms,
  upsertShowroom,
} from "@/infrastructure/server/showroomRepository";
import {
  canWriteShowroom,
  showroomWriteForbiddenMessage,
} from "@/domain/showroom/timesale";
import {
  parseStoreTasteProfile,
  type StoreTasteProfile,
} from "@/domain/passport/passport";

// GET /api/showroom - 쇼룸 모아보기 (인기/최신)
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { searchParams } = new URL(request.url);
  const sort = searchParams.get("sort") === "popular" ? "popular" : "latest";

  const showrooms = await getShowrooms(sort);
  return NextResponse.json({ showrooms });
}

// POST /api/showroom - 바리스타 쇼룸 등록 / 수정
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  if (!canWriteShowroom(user.role)) {
    return jsonError(showroomWriteForbiddenMessage(), 403);
  }

  type ShowroomPayload = {
    storeName?: string;
    bioMessage?: string;
    location?: { latitude: number; longitude: number; address?: string };
    tasteProfile?: unknown;
  };

  const body = await readJson<ShowroomPayload>(request);
  if (!body.storeName?.trim() || !body.bioMessage?.trim()) {
    return jsonError("매장 이름과 한줄 소식을 입력해주세요.");
  }

  let tasteProfile: StoreTasteProfile | undefined;
  if (body.tasteProfile !== undefined) {
    const parsedTaste = parseStoreTasteProfile(body.tasteProfile);
    if (!parsedTaste.ok) {
      return jsonError(parsedTaste.error, 400);
    }
    tasteProfile = parsedTaste.value;
  }

  const showroom = await upsertShowroom({
    userId: user.id,
    storeName: body.storeName,
    bioMessage: body.bioMessage,
    baristaName: user.name,
    avatarUrl: user.avatarUrl,
    location: body.location,
    tasteProfile,
  });

  return NextResponse.json({ showroom }, { status: 200 });
}
