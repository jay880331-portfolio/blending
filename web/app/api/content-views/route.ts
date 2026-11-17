import { type NextRequest, NextResponse } from "next/server";
import { publicContentFilter } from "@/infrastructure/mongodb/adminContentMongoRepository";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { getCurrentUser } from "@/infrastructure/server/auth";
import {
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";

type ContentViewTargetType =
  | "community_b_talk"
  | "community_qa"
  | "community_review"
  | "partner_promotion"
  | "partner_review";

const collectionByTargetType: Record<ContentViewTargetType, string> = {
  community_b_talk: "community_b_talk",
  community_qa: "community_qa_posts",
  community_review: "community_reviews",
  partner_promotion: "partner_promotions",
  partner_review: "partner_reviews",
};

type ContentViewRequest = {
  targetType: ContentViewTargetType;
  targetId: string;
};

type ViewCountDocument = {
  id: string;
  viewCount?: number;
};

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const body = await readJson<ContentViewRequest>(request);
  const targetType = contentViewTargetTypeOrNull(body.targetType);
  const targetId = requireString(body.targetId);
  if (!targetType || !targetId) return jsonError("조회 대상을 확인해 주세요.");

  const db = await getMongoDb();
  const result = await db
    .collection<ViewCountDocument>(collectionByTargetType[targetType])
    .findOneAndUpdate(
      { $and: [{ id: targetId }, publicContentFilter] },
      { $inc: { viewCount: 1 } },
      { returnDocument: "after", projection: { viewCount: 1, _id: 0 } },
    );

  if (!result) return jsonError("조회 대상을 찾을 수 없습니다.", 404);

  return NextResponse.json({ viewCount: result.viewCount ?? 0 });
}

function contentViewTargetTypeOrNull(
  value: unknown,
): ContentViewTargetType | null {
  return typeof value === "string" && value in collectionByTargetType
    ? (value as ContentViewTargetType)
    : null;
}
