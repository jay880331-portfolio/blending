import type { AdminContentKind } from "@blending/admin-contracts";
import type { ClientSession, Db, Document, Filter } from "mongodb";
import type { AdminContentSearchRepository } from "@/application/admin/contentUseCases";
import type {
  CommunityEvent,
  EventReview,
  QaPost,
  Recipe,
} from "@/domain/community/types";
import type { MemberProfile } from "@/domain/member/types";
import type { PartnerPromotion, PartnerReview } from "@/domain/partner/types";
import {
  type MemberSearchCandidate,
  searchMembers,
} from "@/domain/search/memberSearch";
import type {
  SearchDocument,
  SearchDocumentType,
  SearchResult,
} from "@/domain/search/types";
import {
  ADMIN_CONTENT_COLLECTIONS,
  publicContentFilter,
} from "@/infrastructure/mongodb/adminContentMongoRepository";
import { getMongoClient, getMongoDb } from "@/infrastructure/mongodb/client";
import { ensureSeedData } from "@/infrastructure/mongodb/seed";
import {
  activeAccountFilter,
  isActiveAccount,
} from "@/infrastructure/server/accountStatus";
import type { UserDocument } from "@/infrastructure/server/auth";

const SEARCH_COLLECTION = "search_documents";
const SEARCH_LIMIT_MAX = 50;

const searchLabels: Record<SearchDocumentType, string> = {
  community_event: "일정",
  community_review: "후기",
  community_b_talk: "B-TALK",
  community_qa: "Q&A",
  partner_promotion: "홍보관",
  partner_review: "리뷰관",
  member_profile: "프로필",
};

export const publicSearchSourceCollections: Record<SearchDocumentType, string> =
  {
    community_event: "community_events",
    community_review: "community_reviews",
    community_b_talk: "community_b_talk",
    community_qa: "community_qa_posts",
    partner_promotion: "partner_promotions",
    partner_review: "partner_reviews",
    member_profile: "member_profiles",
  };

export type SearchOptions = {
  query: string;
  types?: SearchDocumentType[];
  limit?: number;
  blockedOwnerIds?: string[];
};

export async function searchPublicDocuments({
  query,
  types,
  limit = 20,
  blockedOwnerIds = [],
}: SearchOptions): Promise<SearchResult[]> {
  const normalizedQuery = normalizeWhitespace(query);
  if (normalizedQuery.length < 2) return [];

  const db = await getMongoDb();
  const textSearchQuery = toTextSearchQuery(normalizedQuery);
  if (!textSearchQuery) return [];

  const tokens = textSearchQuery.split(" ");
  const includeMembers = !types?.length || types.includes("member_profile");
  const textTypes = types?.filter((type) => type !== "member_profile");
  const safeLimit = Math.min(Math.max(limit, 1), SEARCH_LIMIT_MAX);

  const [documentResults, memberResults] = await Promise.all([
    types?.length && textTypes?.length === 0
      ? Promise.resolve([])
      : searchIndexedDocuments(db, {
          textSearchQuery,
          tokens,
          textTypes,
          safeLimit,
          blockedOwnerIds,
        }),
    includeMembers
      ? searchMemberResults(db, textSearchQuery, blockedOwnerIds)
      : Promise.resolve([]),
  ]);

  return [...documentResults, ...memberResults]
    .sort((a, b) => b.score - a.score)
    .slice(0, safeLimit);
}

async function searchIndexedDocuments(
  db: Db,
  {
    textSearchQuery,
    tokens,
    textTypes,
    safeLimit,
    blockedOwnerIds,
  }: {
    textSearchQuery: string;
    tokens: string[];
    textTypes?: SearchDocumentType[];
    safeLimit: number;
    blockedOwnerIds: string[];
  },
): Promise<SearchResult[]> {
  const filter: Filter<ScoredSearchDocument> = {
    visibility: "public",
    sourceType: textTypes?.length
      ? { $in: textTypes }
      : { $ne: "member_profile" },
    $text: { $search: textSearchQuery },
  };

  const documents = (
    await db
      .collection<ScoredSearchDocument>(SEARCH_COLLECTION)
      .find(filter, { projection: { textScore: { $meta: "textScore" } } })
      .sort({ textScore: { $meta: "textScore" }, updatedAt: -1 })
      .limit(safeLimit * 4)
      .toArray()
  ).filter((document) => document.sourceType !== "member_profile");

  const existingSourceIds = await existingSourceIdsByType(db, documents, []);
  const existingDocuments = filterExistingSearchDocuments(
    documents,
    existingSourceIds,
  );
  const staleDocumentIds = staleSearchDocumentIds(documents, existingSourceIds);

  if (staleDocumentIds.length > 0) {
    await db
      .collection<SearchDocument>(SEARCH_COLLECTION)
      .deleteMany({ id: { $in: staleDocumentIds } });
  }

  const visibleSourceIds = blockedOwnerIds.length
    ? await existingSourceIdsByType(db, documents, blockedOwnerIds)
    : existingSourceIds;
  return filterExistingSearchDocuments(existingDocuments, visibleSourceIds).map(
    (document) => toSearchResult(document, tokens),
  );
}

const SEARCHABLE_MEMBER_ROLES = ["barista", "enthusiast", "partner"] as const;

async function searchMemberResults(
  db: Db,
  textSearchQuery: string,
  blockedOwnerIds: string[],
): Promise<SearchResult[]> {
  const users = await db
    .collection<UserDocument>("users")
    .find({
      role: { $in: [...SEARCHABLE_MEMBER_ROLES] },
      ...activeAccountFilter(),
      ...(blockedOwnerIds.length ? { id: { $nin: blockedOwnerIds } } : {}),
    })
    .project<
      Pick<UserDocument, "id" | "role" | "name" | "handle" | "accountStatus">
    >({
      _id: 0,
      id: 1,
      role: 1,
      name: 1,
      handle: 1,
      accountStatus: 1,
    })
    .toArray();
  if (users.length === 0) return [];

  const userIds = users.map((user) => user.id);
  const profiles = await db
    .collection<MemberProfile & { ownerId?: string }>("member_profiles")
    .find({ $or: [{ ownerId: { $in: userIds } }, { id: { $in: userIds } }] })
    .project<
      Pick<
        MemberProfile,
        "id" | "name" | "handle" | "workplace" | "avatarUrl"
      > & {
        ownerId?: string;
      }
    >({
      _id: 0,
      id: 1,
      ownerId: 1,
      name: 1,
      handle: 1,
      workplace: 1,
      avatarUrl: 1,
    })
    .toArray();
  const profileByOwnerId = new Map<string, (typeof profiles)[number]>();
  for (const profile of profiles) {
    const ownerId = profile.ownerId ?? profile.id;
    if (!profileByOwnerId.has(ownerId)) profileByOwnerId.set(ownerId, profile);
  }

  const blocked = new Set(blockedOwnerIds);
  const candidates: MemberSearchCandidate[] = users.map((user) => {
    const profile = profileByOwnerId.get(user.id);
    return {
      userId: user.id,
      role: user.role,
      accountStatus: user.accountStatus,
      name: profile?.name || user.name,
      handle: profile?.handle || user.handle,
      workplace: profile?.workplace,
      avatarUrl: profile?.avatarUrl,
      blocked: blocked.has(user.id),
    };
  });

  const query = textSearchQuery.toLowerCase();
  return searchMembers(candidates, textSearchQuery).map((member) => {
    const name = member.name.toLowerCase();
    return {
      id: `member_profile:${member.userId}`,
      type: "member_profile",
      label: searchLabels.member_profile,
      title: member.name,
      excerpt:
        member.handle && member.handle !== member.name
          ? member.handle
          : searchLabels.member_profile,
      ...(member.avatarUrl ? { imageUrl: member.avatarUrl } : {}),
      href: member.href,
      score: name === query ? 30 : name.includes(query) ? 12 : 6,
    };
  });
}

export function staleSearchDocumentIds(
  documents: ScoredSearchDocument[],
  existingSourceIds: Partial<Record<SearchDocumentType, Set<string>>>,
) {
  const existing = filterExistingSearchDocuments(documents, existingSourceIds);
  return documents
    .filter((document) => !existing.includes(document))
    .map((document) => document.id);
}

export function filterExistingSearchDocuments(
  documents: ScoredSearchDocument[],
  existingSourceIds: Partial<Record<SearchDocumentType, Set<string>>>,
) {
  return documents.filter((document) => {
    const sourceIds = existingSourceIds[document.sourceType];
    return !sourceIds || sourceIds.has(document.sourceId);
  });
}

async function existingSourceIdsByType(
  db: Db,
  documents: SearchDocument[],
  blockedOwnerIds: string[],
): Promise<Partial<Record<SearchDocumentType, Set<string>>>> {
  const sourceIdsByType = documents.reduce<
    Partial<Record<SearchDocumentType, Set<string>>>
  >((grouped, document) => {
    const sourceIds = grouped[document.sourceType] ?? new Set<string>();
    sourceIds.add(document.sourceId);
    return { ...grouped, [document.sourceType]: sourceIds };
  }, {});

  const entries = await Promise.all(
    Object.entries(sourceIdsByType).map(async ([sourceType, sourceIds]) => {
      if (sourceType === "member_profile") {
        const profiles = await db
          .collection<MemberProfile & { ownerId?: string }>("member_profiles")
          .find({
            id: { $in: [...sourceIds] },
            ...(blockedOwnerIds.length
              ? { ownerId: { $nin: blockedOwnerIds } }
              : {}),
          })
          .project<{ id: string; ownerId?: string }>({
            _id: 0,
            id: 1,
            ownerId: 1,
          })
          .toArray();
        const ownerIds = profiles.map(
          (profile) => profile.ownerId ?? profile.id,
        );
        const activeOwnerIds = new Set(
          (await db.collection<UserDocument>("users").distinct("id", {
            id: { $in: ownerIds },
            ...activeAccountFilter(),
          })) as string[],
        );
        return [
          sourceType,
          new Set(
            profiles
              .filter((profile) =>
                activeOwnerIds.has(profile.ownerId ?? profile.id),
              )
              .map((profile) => profile.id),
          ),
        ] as const;
      }
      const ids = await db
        .collection(
          publicSearchSourceCollections[sourceType as SearchDocumentType],
        )
        .distinct<string>(
          "id",
          searchSourceFilter([...sourceIds], blockedOwnerIds),
        );
      return [sourceType, new Set(ids)] as const;
    }),
  );

  return Object.fromEntries(entries) as Partial<
    Record<SearchDocumentType, Set<string>>
  >;
}

export function searchSourceFilter(
  sourceIds: string[],
  blockedOwnerIds: string[] = [],
) {
  return {
    $and: [
      { id: { $in: sourceIds } },
      publicContentFilter,
      ...(blockedOwnerIds.length
        ? [{ ownerId: { $nin: blockedOwnerIds } }]
        : []),
    ],
  };
}

export async function syncPublicSearchDocuments() {
  await ensureSeedData();

  const client = await getMongoClient();
  const session = client.startSession();
  try {
    return await session.withTransaction(() =>
      syncPublicSearchDocumentsInSession(session),
    );
  } finally {
    await session.endSession();
  }
}

async function syncPublicSearchDocumentsInSession(session: ClientSession) {
  const db = await getMongoDb();
  const [
    events,
    reviews,
    recipes,
    qaPosts,
    promotions,
    partnerReviews,
    profiles,
  ] = await Promise.all([
    db
      .collection<CommunityEvent>("community_events")
      .find(publicContentFilter, { session })
      .toArray(),
    db
      .collection<EventReview>("community_reviews")
      .find(publicContentFilter, { session })
      .toArray(),
    db
      .collection<Recipe>("community_b_talk")
      .find(publicContentFilter, { session })
      .toArray(),
    db
      .collection<QaPost>("community_qa_posts")
      .find(publicContentFilter, { session })
      .toArray(),
    db
      .collection<PartnerPromotion>("partner_promotions")
      .find(publicContentFilter, { session })
      .toArray(),
    db
      .collection<PartnerReview>("partner_reviews")
      .find(publicContentFilter, { session })
      .toArray(),
    db
      .collection<MemberProfile & { ownerId?: string }>("member_profiles")
      .find({}, { session })
      .toArray(),
  ]);

  const profileOwnerIds = profiles.map(
    (profile) => profile.ownerId ?? profile.id,
  );
  const activeProfileOwnerIds = new Set(
    (await db.collection<UserDocument>("users").distinct(
      "id",
      {
        id: { $in: profileOwnerIds },
        role: { $ne: "admin" },
        ...activeAccountFilter(),
      },
      { session },
    )) as string[],
  );

  const documents = [
    ...events.map(eventToSearchDocument),
    ...reviews.map(reviewToSearchDocument),
    ...recipes.map(recipeToSearchDocument),
    ...qaPosts.map(qaToSearchDocument),
    ...promotions.map(promotionToSearchDocument),
    ...partnerReviews.map(partnerReviewToSearchDocument),
    ...profiles
      .filter((profile) =>
        activeProfileOwnerIds.has(profile.ownerId ?? profile.id),
      )
      .map(profileToSearchDocument),
  ];

  const collection = db.collection<SearchDocument>(SEARCH_COLLECTION);
  const publicSourceTypes = Object.keys(searchLabels) as SearchDocumentType[];

  if (documents.length === 0) {
    await collection.deleteMany(
      {
        visibility: "public",
        sourceType: { $in: publicSourceTypes },
      },
      { session },
    );
    return 0;
  }

  await collection.bulkWrite(
    documents.map((document) => ({
      updateOne: {
        filter: { id: document.id },
        update: { $set: document },
        upsert: true,
      },
    })),
    { ordered: false, session },
  );

  await collection.deleteMany(
    {
      visibility: "public",
      sourceType: { $in: publicSourceTypes },
      id: { $nin: documents.map((document) => document.id) },
    },
    { session },
  );

  return documents.length;
}

export async function upsertSearchDocument(
  document: SearchDocument,
  session?: ClientSession,
) {
  const db = await getMongoDb();
  await db.collection<SearchDocument>(SEARCH_COLLECTION).updateOne(
    { sourceType: document.sourceType, sourceId: document.sourceId },
    {
      $set: document,
    },
    { upsert: true, session },
  );
}

export async function deleteSearchDocument(
  id: string,
  session?: ClientSession,
) {
  const db = await getMongoDb();
  await db
    .collection<SearchDocument>(SEARCH_COLLECTION)
    .deleteOne({ id }, { session });
}

export async function deleteSourceSearchDocument(
  sourceType: SearchDocumentType,
  sourceId: string,
  session?: ClientSession,
) {
  await deleteSearchDocument(`${sourceType}:${sourceId}`, session);
}

type SearchableAdminContentKind = Exclude<AdminContentKind, "partner_banner">;

export function isSearchableAdminContentKind(
  kind: AdminContentKind,
): kind is SearchableAdminContentKind {
  return kind !== "partner_banner";
}

export const adminContentSearchMongoRepository: AdminContentSearchRepository = {
  async upsert(content, session) {
    if (!isSearchableAdminContentKind(content.kind)) return;
    await syncSourceSearchDocument(content.kind, content.id, session);
  },
  async remove(kind, id, session) {
    if (!isSearchableAdminContentKind(kind)) return;
    await deleteSourceSearchDocument(kind, id, session);
  },
};

async function syncSourceSearchDocument(
  kind: SearchableAdminContentKind,
  id: string,
  session?: ClientSession,
) {
  const db = await getMongoDb();
  const source = await db
    .collection(ADMIN_CONTENT_COLLECTIONS[kind])
    .findOne({ $and: [{ id }, publicContentFilter] }, { session });
  if (!source) {
    await deleteSourceSearchDocument(kind, id, session);
    return;
  }

  const document = sourceToSearchDocument(kind, source);
  await upsertSearchDocument(document, session);
}

function sourceToSearchDocument(
  kind: SearchableAdminContentKind,
  source: Document,
) {
  switch (kind) {
    case "community_event":
      return eventToSearchDocument(source as CommunityEvent);
    case "community_review":
      return reviewToSearchDocument(source as EventReview);
    case "community_b_talk":
      return recipeToSearchDocument(source as Recipe);
    case "community_qa":
      return qaToSearchDocument(source as QaPost);
    case "partner_promotion":
      return promotionToSearchDocument(source as PartnerPromotion);
    case "partner_review":
      return partnerReviewToSearchDocument(source as PartnerReview);
  }
}

export async function upsertEventSearchDocument(event: CommunityEvent) {
  await syncSourceSearchDocument("community_event", event.id);
}

export async function upsertReviewSearchDocument(review: EventReview) {
  await syncSourceSearchDocument("community_review", review.id);
}

export async function upsertRecipeSearchDocument(recipe: Recipe) {
  await syncSourceSearchDocument("community_b_talk", recipe.id);
}

export async function upsertQaSearchDocument(post: QaPost) {
  await syncSourceSearchDocument("community_qa", post.id);
}

export async function upsertPromotionSearchDocument(
  promotion: PartnerPromotion,
) {
  await syncSourceSearchDocument("partner_promotion", promotion.id);
}

export async function upsertPartnerReviewSearchDocument(review: PartnerReview) {
  await syncSourceSearchDocument("partner_review", review.id);
}

export async function syncProfileSearchDocument(
  profile: MemberProfile & { ownerId?: string },
  session?: ClientSession,
) {
  const db = await getMongoDb();
  const owner = await db
    .collection<UserDocument>("users")
    .findOne(
      { id: profile.ownerId ?? profile.id },
      { projection: { _id: 0, role: 1, accountStatus: 1 }, session },
    );
  if (!owner || owner.role === "admin" || !isActiveAccount(owner)) {
    await deleteSourceSearchDocument("member_profile", profile.id, session);
    return;
  }

  await upsertSearchDocument(profileToSearchDocument(profile), session);
}

function eventToSearchDocument(event: CommunityEvent): SearchDocument {
  return {
    id: `community_event:${event.id}`,
    sourceType: "community_event",
    sourceId: event.id,
    title: event.title,
    body: [event.description, event.location, event.address].join(" "),
    keywords: [event.category, event.location],
    category: event.category,
    imageUrl: event.imageUrl || event.posterUrl,
    href: "/community",
    visibility: "public",
    createdAt: event.startsAt,
    updatedAt: event.startsAt,
  };
}

function reviewToSearchDocument(review: EventReview): SearchDocument {
  return {
    id: `community_review:${review.id}`,
    sourceType: "community_review",
    sourceId: review.id,
    title: review.title,
    body: review.body,
    keywords: [review.category, ...review.keywords],
    category: review.category,
    authorName: review.author.name,
    imageUrl: review.imageUrls[0],
    href: "/community",
    visibility: "public",
    createdAt: review.createdAt,
    updatedAt: review.createdAt,
  };
}

function recipeToSearchDocument(recipe: Recipe): SearchDocument {
  return {
    id: `community_b_talk:${recipe.id}`,
    sourceType: "community_b_talk",
    sourceId: recipe.id,
    title: recipe.title,
    body: [
      recipe.note,
      recipe.bean.origin,
      recipe.bean.process,
      recipe.bean.roastPoint,
      recipe.extraction.dosing,
      recipe.extraction.yield,
      recipe.extraction.time,
      recipe.extraction.temp,
      ...(recipe.comments?.map((comment) => comment.body) ?? []),
    ].join(" "),
    keywords: [recipe.roast, recipe.bean.origin, recipe.bean.process],
    category: "B-TALK",
    authorName: recipe.author.name,
    imageUrl: recipe.processImages[0] ?? recipe.coverUrl,
    href: `/community/b-talk/${recipe.id.replace(/^recipe-/, "b-talk-")}`,
    visibility: "public",
    createdAt: recipe.createdAt ?? recipe.id,
    updatedAt: recipe.createdAt ?? recipe.id,
  };
}

function qaToSearchDocument(post: QaPost): SearchDocument {
  return {
    id: `community_qa:${post.id}`,
    sourceType: "community_qa",
    sourceId: post.id,
    title: post.title,
    body: [
      post.body,
      ...post.comments.flatMap((comment) => [
        comment.body,
        ...(comment.replies?.map((reply) => reply.body) ?? []),
      ]),
    ].join(" "),
    keywords: ["Q&A"],
    category: "Q&A",
    authorName: post.authorName,
    imageUrl: post.imageUrls?.[0] ?? post.imageUrl,
    href: `/community/qa/${post.id}`,
    visibility: "public",
    createdAt: post.createdAt,
    updatedAt: post.createdAt,
  };
}

function promotionToSearchDocument(
  promotion: PartnerPromotion,
): SearchDocument {
  return {
    id: `partner_promotion:${promotion.id}`,
    sourceType: "partner_promotion",
    sourceId: promotion.id,
    title: promotion.title,
    body: [
      promotion.summary,
      promotion.description,
      promotion.companyName,
      promotion.specs.productName,
      promotion.specs.categoryLabel,
    ].join(" "),
    keywords: [promotion.category, ...promotion.tags],
    category: promotion.specs.categoryLabel,
    authorName: promotion.authorName,
    imageUrl: promotion.thumbnailUrl,
    href: `/partner/promotions/${promotion.id}`,
    visibility: "public",
    createdAt: promotion.createdAt,
    updatedAt: promotion.createdAt,
  };
}

function partnerReviewToSearchDocument(review: PartnerReview): SearchDocument {
  return {
    id: `partner_review:${review.id}`,
    sourceType: "partner_review",
    sourceId: review.id,
    title: review.productName,
    body: [
      review.summary,
      review.body,
      review.brand,
      review.modelName,
      review.features,
      review.baristaTip,
      ...review.majorPros,
    ].join(" "),
    keywords: [review.category, ...review.tags],
    category: review.category,
    authorName: review.reviewer.name,
    imageUrl: review.imageUrls[0],
    href: `/partner/reviews/${review.id}`,
    visibility: "public",
    createdAt: review.createdAt,
    updatedAt: review.createdAt,
  };
}

function profileToSearchDocument(
  profile: MemberProfile & { ownerId?: string },
): SearchDocument {
  return {
    id: `member_profile:${profile.id}`,
    sourceType: "member_profile",
    sourceId: profile.id,
    title: profile.name,
    body:
      profile.isPortfolioPublic === false
        ? profile.handle
        : [
            profile.handle,
            profile.workplace,
            profile.bio,
            profile.certificateName,
          ]
            .filter(Boolean)
            .join(" "),
    keywords: [profile.role, profile.status, ...profile.specialties],
    category: "프로필",
    authorName: profile.name,
    imageUrl: profile.avatarUrl,
    href: `/profile/${profile.id}`,
    visibility: "public",
    ownerId: profile.ownerId,
    createdAt: profile.id,
    updatedAt: profile.id,
  };
}

function toSearchResult(
  document: SearchDocument,
  tokens: string[],
): SearchResult {
  return {
    id: document.id,
    type: document.sourceType,
    label: searchLabels[document.sourceType],
    title: document.title,
    excerpt: createExcerpt(document, tokens),
    imageUrl: document.imageUrl,
    href: document.href,
    score: scoreDocument(document, tokens),
  };
}

function createExcerpt(document: SearchDocument, tokens: string[]) {
  const source = [document.body, document.keywords.join(" ")]
    .filter(Boolean)
    .join(" ");
  const lowerSource = source.toLowerCase();
  const matchIndex = tokens
    .map((token) => lowerSource.indexOf(token.toLowerCase()))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  const start = Math.max(matchIndex ?? 0, 0);
  return source.slice(start, start + 140).trim() || document.category;
}

function scoreDocument(document: SearchDocument, tokens: string[]) {
  const title = document.title.toLowerCase();
  const category = document.category.toLowerCase();
  const keywords = document.keywords.join(" ").toLowerCase();
  const body = document.body.toLowerCase();

  return tokens.reduce((score, token) => {
    const keyword = token.toLowerCase();
    if (title === keyword) return score + 30;
    if (title.includes(keyword)) return score + 12;
    if (category.includes(keyword)) return score + 8;
    if (keywords.includes(keyword)) return score + 6;
    if (body.includes(keyword)) return score + 2;
    return score;
  }, 0);
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function toTextSearchQuery(value: string) {
  return normalizeWhitespace(value)
    .split(" ")
    .map((token) => token.replaceAll('"', "").replace(/^-+/, ""))
    .filter((token) => token.length >= 2)
    .join(" ");
}

type ScoredSearchDocument = SearchDocument & {
  textScore?: number;
};
