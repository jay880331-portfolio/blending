import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import {
  createMenu,
  getShowroomByUserId,
} from "@/infrastructure/server/showroomRepository";
import {
  canWriteShowroom,
  showroomWriteForbiddenMessage,
} from "@/domain/showroom/timesale";
import { validateExchangePoints } from "@/domain/passport/ledger";

// POST /api/showroom/menus - 메뉴 추가
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  if (!canWriteShowroom(user.role)) {
    return jsonError(showroomWriteForbiddenMessage(), 403);
  }

  const showroom = await getShowroomByUserId(user.id);
  if (!showroom) {
    return jsonError("먼저 바리스타 쇼룸을 개설해주세요.", 400);
  }

  type CreateMenuPayload = {
    name?: string;
    price?: number;
    tastingNotes?: string | string[];
    imageUrl?: string;
    exchangePoints?: number | null;
  };

  const body = await readJson<CreateMenuPayload>(request);
  if (!body.name?.trim()) {
    return jsonError("메뉴 이름을 입력해주세요.");
  }

  const parsedExchange = validateExchangePoints(body.exchangePoints);
  if (!parsedExchange.ok) {
    return jsonError(parsedExchange.error, 400);
  }

  const tastingNotes = Array.isArray(body.tastingNotes)
    ? body.tastingNotes
    : typeof body.tastingNotes === "string"
      ? body.tastingNotes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  const menu = await createMenu({
    baristaId: user.id,
    showroomId: showroom.id,
    name: body.name,
    price: typeof body.price === "number" ? body.price : 0,
    tastingNotes,
    imageUrl: body.imageUrl?.trim() || "",
    exchangePoints: parsedExchange.points,
  });

  return NextResponse.json({ menu }, { status: 201 });
}
