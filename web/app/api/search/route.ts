import type { NextRequest } from "next/server";
import type { SearchDocumentType } from "@/domain/search/types";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { searchPublicDocuments } from "@/infrastructure/mongodb/searchMongoRepository";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError } from "@/infrastructure/server/http";
import { UserBlockMongoRepository } from "@/infrastructure/mongodb/userBlockMongoRepository";

const searchTypes: SearchDocumentType[] = [
  "community_event",
  "community_review",
  "community_b_talk",
  "community_qa",
  "partner_promotion",
  "partner_review",
  "member_profile",
];

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const types = parseTypes(searchParams.get("type"));
  const limit = Number(searchParams.get("limit") ?? 20);

  await ensureMongoIndexes();
  const blockedOwnerIds = await new UserBlockMongoRepository().blockedUserIds(
    user.id,
  );

  const results = await searchPublicDocuments({
    query,
    types,
    limit: Number.isFinite(limit) ? limit : 20,
    blockedOwnerIds,
  });

  return Response.json({ query, results });
}

function parseTypes(value: string | null) {
  if (!value || value === "all") return undefined;

  const selectedTypes = value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is SearchDocumentType =>
      searchTypes.includes(item as SearchDocumentType),
    );

  return selectedTypes.length ? selectedTypes : undefined;
}
