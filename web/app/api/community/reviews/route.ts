import { type NextRequest, NextResponse } from "next/server";
import {
  createReview,
  ReviewForbiddenError,
  ReviewValidationError,
  type CreateReviewInput,
} from "@/application/community/createReview";
import { ReviewWriteMongoRepository } from "@/infrastructure/mongodb/reviewWriteMongoRepository";
import { upsertReviewSearchDocument } from "@/infrastructure/mongodb/searchMongoRepository";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { createId, nowIso } from "@/infrastructure/server/content";
import { jsonError, readJson } from "@/infrastructure/server/http";
import { requireContentWriteAllowed } from "@/infrastructure/server/sanctions";

const reviewWriteRepository = new ReviewWriteMongoRepository();

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  try {
    const review = await createReview(
      { id: user.id, handle: user.handle },
      () => readJson<CreateReviewInput>(request),
      {
        assertCanWrite: requireContentWriteAllowed,
        reviewRepository: reviewWriteRepository,
        indexReview: upsertReviewSearchDocument,
        createId,
        nowIso,
      },
    );

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    if (error instanceof ReviewForbiddenError) {
      return jsonError(error.message, 403);
    }
    if (error instanceof ReviewValidationError) {
      return jsonError(error.message, error.status, error.code);
    }
    throw error;
  }
}
