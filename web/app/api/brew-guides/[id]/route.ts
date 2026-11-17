import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import {
  BrewGuideError,
  deleteBrewGuide,
  getBrewGuideById,
  updateBrewGuide,
} from "@/infrastructure/server/brewGuideRepository";
import { jsonError, readJson } from "@/infrastructure/server/http";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await context.params;
  const guide = await getBrewGuideById(id);
  if (!guide) {
    return jsonError("브루 가이드를 찾을 수 없습니다.", 404);
  }
  return NextResponse.json({ guide });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await context.params;
  const body = await readJson<Record<string, unknown>>(request);

  try {
    const guide = await updateBrewGuide(user.id, id, body);
    return NextResponse.json({ guide });
  } catch (error) {
    if (error instanceof BrewGuideError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await context.params;
  try {
    await deleteBrewGuide(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BrewGuideError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
