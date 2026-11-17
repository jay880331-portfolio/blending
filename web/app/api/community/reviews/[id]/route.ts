import { type NextRequest, NextResponse } from "next/server";
import type { EventReview } from "@/domain/community/types";
import { publicContentFilter } from "@/infrastructure/mongodb/adminContentMongoRepository";
import { isContentOwner } from "@/infrastructure/server/contentOwnership";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import {
  deleteSourceSearchDocument,
  upsertReviewSearchDocument,
} from "@/infrastructure/mongodb/searchMongoRepository";
import {
  getCurrentAdminUser,
  getCurrentUser,
} from "@/infrastructure/server/auth";
import { requireContentWriteAllowed } from "@/infrastructure/server/sanctions";
import {
  PROHIBITED_PUBLIC_CONTENT,
  prohibitedPublicContent,
} from "@/infrastructure/server/ugcModeration";
import {
  compactStrings,
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";
import { eventCategoryOrNull } from "@/infrastructure/server/content";

type OwnedEventReview = EventReview & { ownerId?: string };

type RouteParams = {
  params: Promise<{ id: string }>;
};

type UpdateReviewRequest = {
  title: string;
  category?: EventReview["category"];
  imageUrls?: string[];
  keywords?: string[];
  body: string;
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  try {
    await requireContentWriteAllowed(user.id);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "작성할 수 없습니다.",
      403,
    );
  }
  const isAdmin = Boolean(await getCurrentAdminUser(request));

  const { id } = await params;
  const db = await getMongoDb();
  const review = await db
    .collection<OwnedEventReview>("community_reviews")
    .findOne({ $and: [{ id }, publicContentFilter] });

  if (!review) return jsonError("후기를 찾을 수 없습니다.", 404);
  if (!isAdmin && !isOwner(review, user))
    return jsonError("후기를 수정할 권한이 없습니다.", 403);

  const body = await readJson<UpdateReviewRequest>(request);
  const title = requireString(body.title);
  const content = requireString(body.body);
  const category = body.category
    ? eventCategoryOrNull(body.category)
    : review.category;
  if (!title || !content) return jsonError("제목과 내용을 입력해주세요.");
  if (prohibitedPublicContent(title, content, ...compactStrings(body.keywords)))
    return jsonError(
      PROHIBITED_PUBLIC_CONTENT.message,
      400,
      PROHIBITED_PUBLIC_CONTENT.code,
    );
  if (!category) return jsonError("후기 카테고리를 확인해주세요.");

  const updatedReview: OwnedEventReview = {
    ...review,
    title,
    category,
    imageUrls: compactStrings(body.imageUrls),
    keywords: compactStrings(body.keywords),
    body: content,
  };

  const result = await db
    .collection<OwnedEventReview>("community_reviews")
    .updateOne(
      { $and: [{ id }, publicContentFilter] },
      {
        $set: {
          title: updatedReview.title,
          category: updatedReview.category,
          imageUrls: updatedReview.imageUrls,
          keywords: updatedReview.keywords,
          body: updatedReview.body,
        },
      },
    );
  if (result.matchedCount === 0)
    return jsonError("후기를 찾을 수 없습니다.", 404);
  await upsertReviewSearchDocument(updatedReview);

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  try {
    await requireContentWriteAllowed(user.id);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "작성할 수 없습니다.",
      403,
    );
  }
  const isAdmin = Boolean(await getCurrentAdminUser(request));

  const { id } = await params;
  const db = await getMongoDb();
  const review = await db
    .collection<OwnedEventReview>("community_reviews")
    .findOne({ $and: [{ id }, publicContentFilter] });

  if (!review) return jsonError("후기를 찾을 수 없습니다.", 404);
  if (!isAdmin && !isOwner(review, user))
    return jsonError("후기를 삭제할 권한이 없습니다.", 403);

  const result = await db
    .collection<OwnedEventReview>("community_reviews")
    .deleteOne({ $and: [{ id }, publicContentFilter] });
  if (result.deletedCount === 0)
    return jsonError("후기를 찾을 수 없습니다.", 404);
  await deleteSourceSearchDocument("community_review", id);
  await db.collection("content_likes").deleteMany({
    targetType: "community_review",
    targetId: id,
  });
  await db.collection("member_activities").deleteMany({
    href: `/community/reviews/${id}`,
  });

  return NextResponse.json({ success: true });
}

function isOwner(
  review: Pick<OwnedEventReview, "ownerId" | "author">,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
) {
  if (!user) return false;
  return isContentOwner(review.ownerId, user.id);
}
