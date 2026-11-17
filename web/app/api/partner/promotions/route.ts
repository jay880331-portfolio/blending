import { type NextRequest, NextResponse } from "next/server";
import type {
  PartnerAttachment,
  PartnerCategoryValue,
  PartnerPromotion,
} from "@/domain/partner/types";
import { getMongoDb, toDomain } from "@/infrastructure/mongodb/client";
import { upsertPromotionSearchDocument } from "@/infrastructure/mongodb/searchMongoRepository";
import {
  createId,
  firstOrFallback,
  nowIso,
  partnerCategoryOrNull,
} from "@/infrastructure/server/content";
import { getCurrentAdminUser } from "@/infrastructure/server/auth";
import {
  compactStrings,
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";

type CreatePromotionRequest = {
  title: string;
  category: PartnerCategoryValue;
  companyName: string;
  productName: string;
  authorName?: string;
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

const categoryLabels: Record<PartnerCategoryValue, string> = {
  "espresso-machine": "에스프레소 머신",
  grinder: "그라인더",
  "ice-equipment": "제빙기·설비",
  "brewing-roaster": "브루잉·로스터기",
  ingredient: "부재료",
  supplies: "용품·소모품",
};

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdminUser(request);
  if (!admin) return jsonError("관리자 권한이 필요합니다.", 403);

  const body = await readJson<CreatePromotionRequest>(request);
  const title = requireString(body.title);
  const companyName = requireString(body.companyName);
  const productName = requireString(body.productName);
  const description = (body.description ?? "").trim();
  const category = partnerCategoryOrNull(body.category);

  if (!title || !companyName || !productName || !category)
    return jsonError("필수 항목을 입력해 주세요.");

  const imageUrls = compactStrings(body.imageUrls).slice(
    0,
    PARTNER_ATTACHMENT_LIMIT,
  );
  const attachments = compactAttachments(body.attachments);
  const promotion: PartnerPromotion = {
    id: createId("promotion"),
    title,
    category,
    companyName,
    authorName: firstOrFallback(admin.handle ?? body.authorName, companyName),
    createdAt: nowIso(),
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
    likes: 0,
    liked: false,
    viewCount: 0,
    specs: {
      companyName,
      productName,
      categoryLabel: categoryLabels[category],
    },
  };
  const ownedPromotion = { ...promotion, ownerId: admin.id };

  const db = await getMongoDb();
  await db
    .collection<typeof ownedPromotion>("partner_promotions")
    .insertOne(ownedPromotion);
  await upsertPromotionSearchDocument(promotion);

  return NextResponse.json(toDomain(ownedPromotion), { status: 201 });
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
