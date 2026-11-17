import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import {
  createVerifiedStoreReview,
  listStoreReviews,
  PassportError,
} from "@/infrastructure/server/passportRepository";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await context.params;
  const data = await listStoreReviews(id, user.id);
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await context.params;
  const body = await readJson<{ body?: unknown }>(request);
  const reviewBody = typeof body.body === "string" ? body.body : "";

  try {
    const review = await createVerifiedStoreReview({
      userId: user.id,
      storeId: id,
      body: reviewBody,
    });
    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    if (error instanceof PassportError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
