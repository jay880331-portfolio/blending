import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import {
  BeanReservationError,
  deleteStoreBean,
  updateStoreBean,
} from "@/infrastructure/server/beanReservationRepository";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; beanId: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { id, beanId } = await context.params;
  const body = await readJson<Record<string, unknown>>(request);

  try {
    const bean = await updateStoreBean(user.id, id, beanId, body);
    return NextResponse.json({ bean });
  } catch (error) {
    if (error instanceof BeanReservationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; beanId: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { id, beanId } = await context.params;

  try {
    await deleteStoreBean(user.id, id, beanId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof BeanReservationError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
