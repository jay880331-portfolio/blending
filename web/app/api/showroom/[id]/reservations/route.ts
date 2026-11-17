import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import {
  BeanReservationError,
  createBeanReservation,
  listStoreReservations,
} from "@/infrastructure/server/beanReservationRepository";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await context.params;
  try {
    const reservations = await listStoreReservations(user.id, id);
    return NextResponse.json(
      { reservations },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof BeanReservationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
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
    const reservation = await createBeanReservation(user.id, id, body);
    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    if (error instanceof BeanReservationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
