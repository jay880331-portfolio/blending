import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import {
  BeanReservationError,
  createStoreBean,
  listStoreBeans,
} from "@/infrastructure/server/beanReservationRepository";
import { getShowroomById } from "@/infrastructure/server/showroomRepository";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await context.params;
  const includeInactive =
    request.nextUrl.searchParams.get("includeInactive") === "true";

  if (includeInactive) {
    const showroom = await getShowroomById(id);
    if (!showroom || showroom.userId !== user.id) {
      return jsonError("비활성 상품은 소유자만 조회할 수 있습니다.", 403);
    }
  }

  const beans = await listStoreBeans(id, { includeInactive });
  return NextResponse.json(
    { beans },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await context.params;
  const body = await readJson<Record<string, unknown>>(request);

  try {
    const bean = await createStoreBean(user.id, id, body);
    return NextResponse.json({ bean }, { status: 201 });
  } catch (error) {
    if (error instanceof BeanReservationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
