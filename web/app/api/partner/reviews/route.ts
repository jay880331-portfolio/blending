import { type NextRequest, NextResponse } from "next/server";
import type {
  PartnerAttachment,
  PartnerCategoryValue,
  PartnerReview,
} from "@/domain/partner/types";
import { getMongoDb, toDomain } from "@/infrastructure/mongodb/client";
import { upsertPartnerReviewSearchDocument } from "@/infrastructure/mongodb/searchMongoRepository";
import {
  createId,
  firstOrFallback,
  nowIso,
  partnerCategoryOrNull,
} from "@/infrastructure/server/content";
import {
  compactStrings,
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { requireContentWriteAllowed } from "@/infrastructure/server/sanctions";
import {
  PROHIBITED_PUBLIC_CONTENT,
  prohibitedPublicContent,
} from "@/infrastructure/server/ugcModeration";

type CreatePartnerReviewRequest = {
  promotionId?: string;
  productName: string;
  category: PartnerCategoryValue;
  brand: string;
  modelName: string;
  features?: string;
  reviewerName?: string;
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

export async function POST(request: NextRequest) {
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
  const body = await readJson<CreatePartnerReviewRequest>(request);
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

  const review: PartnerReview = {
    id: createId("partner-review"),
    promotionId: body.promotionId ?? "custom",
    productName,
    category,
    brand,
    modelName,
    features: firstOrFallback(body.features, ""),
    createdAt: nowIso(),
    reviewer: {
      name: firstOrFallback(user?.handle ?? body.reviewerName, "익명"),
    },
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
    likes: 0,
    liked: false,
    viewCount: 0,
  };
  const ownedReview = user ? { ...review, ownerId: user.id } : review;

  const db = await getMongoDb();
  await db
    .collection<typeof ownedReview>("partner_reviews")
    .insertOne(ownedReview);
  await upsertPartnerReviewSearchDocument(review);

  return NextResponse.json(
    { ...toDomain(ownedReview), isOwner: Boolean(user) },
    { status: 201 },
  );
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
