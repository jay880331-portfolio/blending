import { type NextRequest, NextResponse } from "next/server";
import type { ReservationStatus } from "@/domain/showroom/bean";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import {
  BeanReservationError,
  transitionBeanReservation,
} from "@/infrastructure/server/beanReservationRepository";

const VALID_STATUSES = new Set<string>([
  "CONFIRMED",
  "REJECTED",
  "PICKED_UP",
  "CANCELLED",
]);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await context.params;
  const body = await readJson<{ status?: unknown; rejectReason?: unknown }>(
    request,
  );
  if (typeof body.status !== "string" || !VALID_STATUSES.has(body.status)) {
    return jsonError("변경할 예약 상태가 올바르지 않습니다.", 400);
  }

  try {
    const reservation = await transitionBeanReservation({
      actorUserId: user.id,
      reservationId: id,
      nextStatus: body.status as ReservationStatus,
      rejectReason:
        typeof body.rejectReason === "string" ? body.rejectReason : undefined,
    });
    return NextResponse.json({ reservation });
  } catch (error) {
    if (error instanceof BeanReservationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
