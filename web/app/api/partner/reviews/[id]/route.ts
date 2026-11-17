import { type NextRequest, NextResponse } from "next/server";
import type { PartnerAttachment, PartnerReview } from "@/domain/partner/types";
import { publicContentFilter } from "@/infrastructure/mongodb/adminContentMongoRepository";
import { isContentOwner } from "@/infrastructure/server/contentOwnership";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import {
  deleteSourceSearchDocument,
  upsertPartnerReviewSearchDocument,
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
import {
  firstOrFallback,
  partnerCategoryOrNull,
} from "@/infrastructure/server/content";

type OwnedPartnerReview = PartnerReview & { ownerId?: string };

type RouteParams = {
  params: Promise<{ id: string }>;
};

type UpdatePartnerReviewRequest = {
  productName: string;
  category: PartnerReview["category"];
  brand: string;
  modelName: string;
  features?: string;
  summary?: string;
  body: string;
  imageUrls?: string[];
  attachments?: PartnerAttachment[];
  tags?: string[];
  majorPros?: string[];
  baristaTip?: string;
  relatedUrl?: string;
};

const PARTNER_ATTACHMENT_LIMIT = 6;

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
    .collection<OwnedPartnerReview>("partner_reviews")
    .findOne({ $and: [{ id }, publicContentFilter] });

  if (!review) return jsonError("리뷰를 찾을 수 없습니다.", 404);
  if (!isAdmin && !isOwner(review, user))
    return jsonError("리뷰를 수정할 권한이 없습니다.", 403);

  const body = await readJson<UpdatePartnerReviewRequest>(request);
  const productName = requireString(body.productName);
  const brand = requireString(body.brand);
  const modelName = requireString(body.modelName);
  const content = requireString(body.body);
  const category = partnerCategoryOrNull(body.category);
  if (!productName || !brand || !modelName || !content || !category)
    return jsonError("필수 항목을 입력해 주세요.");
  if (
    prohibitedPublicContent(
      productName,
      brand,
      modelName,
      content,
      body.features,
      body.summary,
      body.baristaTip,
      ...compactStrings(body.tags),
      ...compactStrings(body.majorPros),
    )
  )
    return jsonError(
      PROHIBITED_PUBLIC_CONTENT.message,
      400,
      PROHIBITED_PUBLIC_CONTENT.code,
    );

  const updatedReview: OwnedPartnerReview = {
    ...review,
    productName,
    category,
    brand,
    modelName,
    features: firstOrFallback(body.features, ""),
    summary: firstOrFallback(body.summary, content.slice(0, 90)),
    body: content,
    imageUrls: compactStrings(body.imageUrls).slice(
      0,
      PARTNER_ATTACHMENT_LIMIT,
    ),
    attachments: compactAttachments(body.attachments),
    tags: compactStrings(body.tags),
    majorPros: compactStrings(body.majorPros),
    baristaTip: firstOrFallback(body.baristaTip, ""),
    relatedUrl: body.relatedUrl,
  };

  const result = await db
    .collection<OwnedPartnerReview>("partner_reviews")
    .updateOne(
      { $and: [{ id }, publicContentFilter] },
      {
        $set: {
          productName: updatedReview.productName,
          category: updatedReview.category,
          brand: updatedReview.brand,
          modelName: updatedReview.modelName,
          features: updatedReview.features,
          summary: updatedReview.summary,
          body: updatedReview.body,
          imageUrls: updatedReview.imageUrls,
          attachments: updatedReview.attachments,
          tags: updatedReview.tags,
          majorPros: updatedReview.majorPros,
          baristaTip: updatedReview.baristaTip,
          relatedUrl: updatedReview.relatedUrl,
        },
      },
    );
  if (result.matchedCount === 0)
    return jsonError("리뷰를 찾을 수 없습니다.", 404);
  await upsertPartnerReviewSearchDocument(updatedReview);

  return NextResponse.json({ success: true });
}

function compactAttachments(
  attachments: PartnerAttachment[] | undefined,
): PartnerAttachment[] {
  return (attachments ?? [])
    .slice(0, PARTNER_ATTACHMENT_LIMIT)
    .flatMap((attachment) => {
      const url = requireString(attachment.url);
      if (!url) return [];
      return {
        url,
        name: firstOrFallback(attachment.name, "첨부파일"),
        size: Number.isFinite(attachment.size) ? attachment.size : 0,
        contentType: firstOrFallback(
          attachment.contentType,
          "application/octet-stream",
        ),
      };
    });
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
    .collection<OwnedPartnerReview>("partner_reviews")
    .findOne({ $and: [{ id }, publicContentFilter] });

  if (!review) return jsonError("리뷰를 찾을 수 없습니다.", 404);
  if (!isAdmin && !isOwner(review, user))
    return jsonError("리뷰를 삭제할 권한이 없습니다.", 403);

  const result = await db
    .collection<OwnedPartnerReview>("partner_reviews")
    .deleteOne({ $and: [{ id }, publicContentFilter] });
  if (result.deletedCount === 0)
    return jsonError("리뷰를 찾을 수 없습니다.", 404);
  await deleteSourceSearchDocument("partner_review", id);
  await db.collection("content_likes").deleteMany({
    targetType: "partner_review",
    targetId: id,
  });
  return NextResponse.json({ success: true });
}

function isOwner(
  review: Pick<OwnedPartnerReview, "ownerId" | "reviewer">,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
) {
  if (!user) return false;
  return isContentOwner(review.ownerId, user.id);
}
