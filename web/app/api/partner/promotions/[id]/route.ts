import { type NextRequest, NextResponse } from "next/server";
import type {
  PartnerAttachment,
  PartnerPromotion,
} from "@/domain/partner/types";
import { publicContentFilter } from "@/infrastructure/mongodb/adminContentMongoRepository";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import {
  deleteSourceSearchDocument,
  upsertPromotionSearchDocument,
} from "@/infrastructure/mongodb/searchMongoRepository";
import { getCurrentAdminUser } from "@/infrastructure/server/auth";
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

type RouteParams = {
  params: Promise<{ id: string }>;
};

type UpdatePromotionRequest = {
  title: string;
  category: PartnerPromotion["category"];
  companyName: string;
  productName: string;
  summary?: string;
  description: string;
  thumbnailUrl?: string;
  imageUrls?: string[];
  attachments?: PartnerAttachment[];
  brochureUrls?: string[];
  tags?: string[];
  externalUrl?: string;
  publishedFrom?: string;
  publishedTo?: string;
};

const PARTNER_ATTACHMENT_LIMIT = 6;

const categoryLabels: Record<PartnerPromotion["category"], string> = {
  "espresso-machine": "에스프레소 머신",
  grinder: "그라인더",
  "ice-equipment": "제빙기·설비",
  "brewing-roaster": "브루잉·로스터기",
  ingredient: "부재료",
  supplies: "용품·소모품",
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const admin = await getCurrentAdminUser(request);
  if (!admin) return jsonError("관리자 권한이 필요합니다.", 403);

  const body = await readJson<UpdatePromotionRequest>(request);
  const title = requireString(body.title);
  const companyName = requireString(body.companyName);
  const productName = requireString(body.productName);
  const description = (body.description ?? "").trim();
  const category = partnerCategoryOrNull(body.category);
  if (!title || !companyName || !productName || !category)
    return jsonError("필수 항목을 입력해 주세요.");

  const { id } = await params;
  const imageUrls = compactStrings(body.imageUrls).slice(
    0,
    PARTNER_ATTACHMENT_LIMIT,
  );
  const attachments = compactAttachments(body.attachments);
  const db = await getMongoDb();
  const promotion = await db
    .collection<PartnerPromotion>("partner_promotions")
    .findOne({ $and: [{ id }, publicContentFilter] });
  if (!promotion) return jsonError("홍보글을 찾을 수 없습니다.", 404);

  const updatedPromotion: PartnerPromotion = {
    ...promotion,
    title,
    category,
    companyName,
    summary: firstOrFallback(body.summary, description.slice(0, 90)),
    description,
    thumbnailUrl: firstOrFallback(
      body.thumbnailUrl ?? imageUrls[0],
      "/favicon.ico",
    ),
    imageUrls,
    attachments,
    brochureUrls: compactStrings(body.brochureUrls),
    tags: compactStrings(body.tags),
    externalUrl: body.externalUrl,
    publishedFrom: body.publishedFrom,
    publishedTo: body.publishedTo,
    specs: {
      companyName,
      productName,
      categoryLabel: categoryLabels[category],
    },
  };

  const result = await db
    .collection<PartnerPromotion>("partner_promotions")
    .updateOne(
      { $and: [{ id }, publicContentFilter] },
      {
        $set: {
          title: updatedPromotion.title,
          category: updatedPromotion.category,
          companyName: updatedPromotion.companyName,
          summary: updatedPromotion.summary,
          description: updatedPromotion.description,
          thumbnailUrl: updatedPromotion.thumbnailUrl,
          imageUrls: updatedPromotion.imageUrls,
          attachments: updatedPromotion.attachments,
          brochureUrls: updatedPromotion.brochureUrls,
          tags: updatedPromotion.tags,
          externalUrl: updatedPromotion.externalUrl,
          publishedFrom: updatedPromotion.publishedFrom,
          publishedTo: updatedPromotion.publishedTo,
          specs: updatedPromotion.specs,
        },
      },
    );

  if (result.matchedCount === 0)
    return jsonError("홍보글을 찾을 수 없습니다.", 404);
  await upsertPromotionSearchDocument(updatedPromotion);

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
  const admin = await getCurrentAdminUser(request);
  if (!admin) return jsonError("관리자 권한이 필요합니다.", 403);

  const { id } = await params;
  const db = await getMongoDb();
  const result = await db
    .collection<PartnerPromotion>("partner_promotions")
    .deleteOne({ $and: [{ id }, publicContentFilter] });

  if (result.deletedCount === 0)
    return jsonError("홍보글을 찾을 수 없습니다.", 404);
  await deleteSourceSearchDocument("partner_promotion", id);

  await db.collection("content_likes").deleteMany({
    targetType: "partner_promotion",
    targetId: id,
  });

  return NextResponse.json({ success: true });
}
