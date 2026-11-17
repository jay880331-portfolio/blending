import {
  ADMIN_CONTENT_KINDS,
  type AdminContentDto,
  type AdminContentInput,
  type AdminContentKind,
  type AdminContentListQuery,
  type AdminContentPage,
  type AdminContentReactionDto,
  type AdminContentState,
  type AdminEventRequestDto,
  type AdminEventRequestListQuery,
  type AdminEventRequestPage,
  type AdminPage,
  type AdminPageSize,
} from "@blending/admin-contracts";
import {
  ObjectId,
  type ClientSession,
  type Document,
  type Filter,
  type UpdateFilter,
} from "mongodb";
import type { AdminContentMutationResult } from "@/application/admin/contentUseCases";
import type { EventRequestRepository } from "@/application/admin/eventRequestUseCases";
import { getMongoDb } from "@/infrastructure/mongodb/client";

export const ADMIN_CONTENT_COLLECTIONS: Record<AdminContentKind, string> = {
  community_event: "community_events",
  community_review: "community_reviews",
  community_b_talk: "community_b_talk",
  community_qa: "community_qa_posts",
  partner_promotion: "partner_promotions",
  partner_review: "partner_reviews",
  partner_banner: "partner_banners",
};

const REACTION_KINDS = new Set<AdminContentKind>([
  "community_review",
  "community_b_talk",
  "community_qa",
  "partner_promotion",
  "partner_review",
]);

export const publicContentFilter = {
  $or: [
    { moderationStatus: "active" },
    { moderationStatus: { $exists: false } },
  ],
};

export class AdminContentNotFoundError extends Error {}
export class AdminContentConflictError extends Error {}
export class AdminContentInputError extends Error {}

export function isPublicContent(content: {
  moderationStatus?: AdminContentState;
}) {
  return (
    content.moderationStatus === undefined ||
    content.moderationStatus === "active"
  );
}

export function contentStateFilter(state: AdminContentState) {
  return state === "active" ? publicContentFilter : { moderationStatus: state };
}

export function isAdminContentKind(value: string): value is AdminContentKind {
  return ADMIN_CONTENT_KINDS.includes(value as AdminContentKind);
}

export function reactionDeleteFilter(
  kind: AdminContentKind,
  contentId: string,
  reactionId: string,
) {
  if (!ObjectId.isValid(reactionId))
    throw new AdminContentInputError("반응 ID를 확인해주세요.");
  return {
    _id: new ObjectId(reactionId),
    targetType: kind,
    targetId: contentId,
  };
}

export function contentUpdateFields(input: AdminContentInput): Document {
  switch (input.kind) {
    case "community_event":
      return pick(input, [
        "title",
        "category",
        "startsAt",
        "endsAt",
        "location",
        "address",
        "imageUrl",
        "posterUrl",
        "description",
        "applyUrl",
      ]);
    case "community_review":
      return {
        ...pick(input, [
          "eventId",
          "title",
          "category",
          "body",
          "imageUrls",
          "keywords",
        ]),
        author: {
          name: input.authorName,
          ...(input.authorHandle ? { handle: input.authorHandle } : {}),
          ...(input.authorAvatarUrl
            ? { avatarUrl: input.authorAvatarUrl }
            : {}),
        },
      };
    case "community_b_talk":
      return {
        ...pick(input, [
          "title",
          "roast",
          "coverUrl",
          "processImages",
          "bean",
          "extraction",
          "note",
        ]),
        author: {
          name: input.authorName,
          ...(input.authorHandle ? { handle: input.authorHandle } : {}),
          ...(input.authorAvatarUrl
            ? { avatarUrl: input.authorAvatarUrl }
            : {}),
        },
      };
    case "community_qa":
      return {
        ...pick(input, ["title", "body", "imageUrls"]),
        authorName: input.authorName,
        ...(input.authorAvatarUrl
          ? { authorAvatarUrl: input.authorAvatarUrl }
          : {}),
      };
    case "partner_promotion":
      return {
        ...pick(input, [
          "title",
          "category",
          "companyName",
          "summary",
          "description",
          "thumbnailUrl",
          "imageUrls",
          "attachments",
          "brochureUrls",
          "tags",
          "externalUrl",
          "specs",
        ]),
        authorName: input.authorName,
        ...(input.authorAvatarUrl
          ? { authorAvatarUrl: input.authorAvatarUrl }
          : {}),
      };
    case "partner_review":
      return {
        ...pick(input, [
          "promotionId",
          "productName",
          "category",
          "brand",
          "modelName",
          "features",
          "summary",
          "body",
          "imageUrls",
          "attachments",
          "tags",
          "majorPros",
          "baristaTip",
          "relatedUrl",
        ]),
        reviewer: {
          name: input.reviewerName,
          ...(input.reviewerAvatarUrl
            ? { avatarUrl: input.reviewerAvatarUrl }
            : {}),
          ...(input.reviewerResumeUrl
            ? { resumeUrl: input.reviewerResumeUrl }
            : {}),
        },
      };
    case "partner_banner":
      return pick(input, [
        "title",
        "subtitle",
        "imageUrl",
        "href",
        "sortOrder",
        "activeFrom",
        "activeTo",
      ]);
  }
}

export function contentUnsetFields(input: AdminContentInput): Document {
  const optionalKeys: Partial<Record<AdminContentKind, readonly string[]>> = {
    community_event: ["endsAt", "applyUrl"],
    community_b_talk: ["coverUrl"],
    community_qa: ["authorAvatarUrl"],
    partner_promotion: ["authorAvatarUrl", "attachments", "externalUrl"],
    partner_review: ["attachments", "relatedUrl"],
  };
  return Object.fromEntries(
    (optionalKeys[input.kind] ?? []).flatMap((key) =>
      input[key as keyof AdminContentInput] === null ? [[key, ""]] : [],
    ),
  );
}

export function buildContentMongoUpdate(
  current: AdminContentInput,
  input: AdminContentInput,
  updatedAt: string,
  claimedOwnerId?: string,
): UpdateFilter<Document> {
  const mergedInput = { ...current, ...input } as AdminContentInput;
  const set: Document = {
    ...contentUpdateFields(mergedInput),
    ...(claimedOwnerId ? { ownerId: claimedOwnerId } : {}),
    updatedAt,
  };
  const unset = contentUnsetFields(input);
  for (const path of Object.keys(unset)) delete set[path];
  return {
    $set: set,
    ...(Object.keys(unset).length ? { $unset: unset } : {}),
  };
}

export function resolveContentOwnerUpdate(
  currentOwnerId: string | undefined,
  submittedOwnerId: string,
): { claim: boolean; filter: Filter<Document> } {
  if (!currentOwnerId)
    return {
      claim: true,
      filter: { $or: [{ ownerId: { $exists: false } }, { ownerId: "" }] },
    };
  if (currentOwnerId !== submittedOwnerId)
    throw new AdminContentConflictError("콘텐츠 소유자를 변경할 수 없습니다.");
  return {
    claim: false,
    filter: { ownerId: submittedOwnerId },
  };
}

export function toAdminContentDto(
  kind: AdminContentKind,
  raw: Document,
): AdminContentDto {
  const state = asState(raw.moderationStatus);
  const ownerId = asOptionalString(raw.ownerId);
  const base = {
    id: asString(raw.id),
    kind,
    state,
    ...(ownerId ? { ownerId } : {}),
    title:
      kind === "partner_review"
        ? asString(raw.productName)
        : asString(raw.title),
    ...optionalDtoString(raw, "createdAt"),
    ...optionalDtoString(raw, "updatedAt"),
    ...optionalDtoString(raw, "moderationReason"),
    views: asNumber(raw.viewCount),
    likes: asNumber(raw.likes),
    searchVisible: state === "active" && kind !== "partner_banner",
  };

  return { ...base, data: inputFromDocument(kind, raw, ownerId) };
}

export class AdminContentMongoRepository {
  async list(query: AdminContentListQuery): Promise<AdminContentPage> {
    const db = await getMongoDb();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const filter = adminContentFilter(query);
    const direction = query.direction === "asc" ? 1 : -1;
    const sortField = contentSortField(query.kind, query.sort);
    const collection = db.collection<Document>(
      ADMIN_CONTENT_COLLECTIONS[query.kind],
    );
    const [documents, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ [sortField]: direction, id: direction })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      collection.countDocuments(filter),
    ]);
    return {
      items: documents.map((document) =>
        toAdminContentDto(query.kind, document),
      ),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findById(
    kind: AdminContentKind,
    id: string,
    session?: ClientSession,
  ): Promise<AdminContentDto | null> {
    const db = await getMongoDb();
    const document = await db
      .collection<Document>(ADMIN_CONTENT_COLLECTIONS[kind])
      .findOne({ id }, { session });
    return document ? toAdminContentDto(kind, document) : null;
  }

  async create(
    kind: AdminContentKind,
    id: string,
    input: AdminContentInput,
    session: ClientSession,
  ) {
    assertKind(kind, input);
    const now = new Date().toISOString();
    const document = {
      id,
      ...contentCreateFields(input),
      ...(hasOwner(input) ? { ownerId: input.ownerId } : {}),
      ...contentDefaults(kind, now),
      moderationStatus: "active",
      updatedAt: now,
    };
    const db = await getMongoDb();
    if (kind === "partner_banner")
      await assertBannerSlotAvailable(db, input, session);
    try {
      await db
        .collection(ADMIN_CONTENT_COLLECTIONS[kind])
        .insertOne(document, { session });
    } catch (error) {
      if (isDuplicateKey(error)) throw new AdminContentConflictError();
      throw error;
    }
    return toAdminContentDto(kind, document);
  }

  async update(
    kind: AdminContentKind,
    id: string,
    input: AdminContentInput,
    session: ClientSession,
  ) {
    assertKind(kind, input);
    const current = await this.findById(kind, id, session);
    if (!current) throw new AdminContentNotFoundError();
    if (current.state === "deleted") throw new AdminContentConflictError();
    const submittedOwnerId = hasOwner(input) ? input.ownerId : undefined;
    const ownerUpdate = submittedOwnerId
      ? resolveContentOwnerUpdate(current.ownerId, submittedOwnerId)
      : undefined;
    const update = buildContentMongoUpdate(
      current.data,
      input,
      new Date().toISOString(),
      ownerUpdate?.claim ? submittedOwnerId : undefined,
    );

    const db = await getMongoDb();
    if (kind === "partner_banner")
      await assertBannerSlotAvailable(db, input, session, id);
    const document = await db
      .collection<Document>(ADMIN_CONTENT_COLLECTIONS[kind])
      .findOneAndUpdate(
        {
          $and: [
            { id },
            { moderationStatus: { $ne: "deleted" } },
            ...(ownerUpdate ? [ownerUpdate.filter] : []),
          ],
        },
        update,
        { returnDocument: "after", session },
      );
    if (!document) throw new AdminContentConflictError();
    return {
      content: toAdminContentDto(kind, document),
      ownerClaimed: Boolean(ownerUpdate?.claim),
    };
  }

  async changeState(
    kind: AdminContentKind,
    id: string,
    state: AdminContentState,
    reason: string,
    session: ClientSession,
  ): Promise<AdminContentMutationResult> {
    const db = await getMongoDb();
    const now = new Date().toISOString();
    const document = await db
      .collection<Document>(ADMIN_CONTENT_COLLECTIONS[kind])
      .findOneAndUpdate(
        { id, moderationStatus: { $ne: state } },
        {
          $set: {
            moderationStatus: state,
            moderationReason: reason,
            moderatedAt: now,
            updatedAt: now,
          },
        },
        { returnDocument: "after", session },
      );
    if (document)
      return { content: toAdminContentDto(kind, document), changed: true };

    const current = await this.findById(kind, id, session);
    if (!current) throw new AdminContentNotFoundError();
    return { content: current, changed: false };
  }

  async listReactions(
    kind: AdminContentKind,
    id: string,
    page = 1,
    pageSize: AdminPageSize = 20,
  ): Promise<AdminPage<AdminContentReactionDto>> {
    assertReactionKind(kind);
    const db = await getMongoDb();
    const filter = { targetType: kind, targetId: id };
    const collection = db.collection("content_likes");
    const [likes, total] = await Promise.all([
      collection
        .find(filter, {
          projection: { _id: 1, identityKey: 1, createdAt: 1 },
        })
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      collection.countDocuments(filter),
    ]);
    return {
      items: likes.map(toReactionDto),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async deleteReaction(
    kind: AdminContentKind,
    contentId: string,
    reactionId: string,
    session: ClientSession,
  ) {
    assertReactionKind(kind);
    const db = await getMongoDb();
    const result = await db
      .collection("content_likes")
      .deleteOne(reactionDeleteFilter(kind, contentId, reactionId), {
        session,
      });
    if (result.deletedCount === 0) return false;
    await db.collection(ADMIN_CONTENT_COLLECTIONS[kind]).updateOne(
      { id: contentId },
      [
        {
          $set: {
            likes: {
              $max: [0, { $subtract: [{ $ifNull: ["$likes", 0] }, 1] }],
            },
          },
        },
      ],
      { session },
    );
    return true;
  }
}

function adminContentFilter(query: AdminContentListQuery): Filter<Document> {
  const conditions: Filter<Document>[] = [];
  if (query.state) conditions.push(contentStateFilter(query.state));
  if (query.authorId) conditions.push({ ownerId: query.authorId });
  if (query.q) {
    const q = new RegExp(escapeRegex(query.q), "i");
    conditions.push({
      $or: [{ title: q }, { productName: q }, { body: q }, { description: q }],
    });
  }
  if (query.from || query.to) {
    conditions.push({
      [contentDateField(query.kind)]: {
        ...(query.from ? { $gte: `${query.from}T00:00:00.000Z` } : {}),
        ...(query.to ? { $lte: `${query.to}T23:59:59.999Z` } : {}),
      },
    });
  }
  return conditions.length ? { $and: conditions } : {};
}

function contentSortField(kind: AdminContentKind, sort?: string) {
  if (sort === "title")
    return kind === "partner_review" ? "productName" : "title";
  if (sort === "views") return "viewCount";
  if (sort === "likes") return "likes";
  if (sort === "updatedAt") return "updatedAt";
  return contentDateField(kind);
}

function contentDateField(kind: AdminContentKind) {
  if (kind === "community_event") return "startsAt";
  if (kind === "partner_banner") return "createdAt";
  return "createdAt";
}

function contentDefaults(kind: AdminContentKind, now: string): Document {
  switch (kind) {
    case "community_event":
    case "partner_banner":
      return { createdAt: now };
    case "community_review":
      return { createdAt: now, likes: 0 };
    case "community_b_talk":
      return {
        createdAt: now,
        likes: 0,
        liked: false,
        viewCount: 0,
        comments: [],
        commentCount: 0,
      };
    case "community_qa":
      return {
        createdAt: now,
        createdAgo: "방금 전",
        likes: 0,
        liked: false,
        viewCount: 0,
        comments: [],
        commentCount: 0,
      };
    case "partner_promotion":
    case "partner_review":
      return { createdAt: now, likes: 0, liked: false, viewCount: 0 };
  }
}

function contentCreateFields(input: AdminContentInput) {
  const fields = contentUpdateFields(input);
  if (
    (input.kind === "community_review" || input.kind === "community_b_talk") &&
    fields.author &&
    typeof fields.author === "object" &&
    !("handle" in fields.author)
  ) {
    fields.author = { ...fields.author, handle: input.ownerId };
  }
  return fields;
}

function inputFromDocument(
  kind: AdminContentKind,
  raw: Document,
  ownerId?: string,
): AdminContentInput {
  const owner = ownerId ?? "";
  const author = asDocument(raw.author);
  const reviewer = asDocument(raw.reviewer);
  switch (kind) {
    case "community_event":
      return {
        kind,
        title: asString(raw.title),
        category: asEventCategory(raw.category),
        startsAt: asString(raw.startsAt),
        ...(asOptionalString(raw.endsAt)
          ? { endsAt: asString(raw.endsAt) }
          : {}),
        location: asString(raw.location),
        address: asString(raw.address),
        imageUrl: asString(raw.imageUrl),
        posterUrl: asString(raw.posterUrl),
        description: asString(raw.description),
        ...(asOptionalString(raw.applyUrl)
          ? { applyUrl: asString(raw.applyUrl) }
          : {}),
      };
    case "community_review":
      return {
        kind,
        ownerId: owner,
        eventId: asString(raw.eventId),
        title: asString(raw.title),
        category: asEventCategory(raw.category),
        authorName: asString(author.name),
        ...optionalInputString(author, "handle", "authorHandle"),
        ...optionalInputString(author, "avatarUrl", "authorAvatarUrl"),
        body: asString(raw.body),
        imageUrls: asStringArray(raw.imageUrls),
        keywords: asStringArray(raw.keywords),
      };
    case "community_b_talk":
      return {
        kind,
        ownerId: owner,
        title: asString(raw.title),
        roast: asRoast(raw.roast),
        authorName: asString(author.name),
        ...optionalInputString(author, "handle", "authorHandle"),
        ...optionalInputString(author, "avatarUrl", "authorAvatarUrl"),
        ...optionalInputString(raw, "coverUrl", "coverUrl"),
        processImages: asStringArray(raw.processImages),
        bean: asStringRecord(raw.bean, ["origin", "process", "roastPoint"]),
        extraction: asStringRecord(raw.extraction, [
          "dosing",
          "yield",
          "time",
          "temp",
        ]),
        note: asString(raw.note),
      };
    case "community_qa":
      return {
        kind,
        ownerId: owner,
        title: asString(raw.title),
        authorName: asString(raw.authorName),
        ...optionalInputString(raw, "authorAvatarUrl", "authorAvatarUrl"),
        body: asString(raw.body),
        imageUrls: asStringArray(raw.imageUrls),
      };
    case "partner_promotion":
      return {
        kind,
        ownerId: owner,
        title: asString(raw.title),
        category: asPartnerCategory(raw.category),
        companyName: asString(raw.companyName),
        authorName: asString(raw.authorName),
        ...optionalInputString(raw, "authorAvatarUrl", "authorAvatarUrl"),
        summary: asString(raw.summary),
        description: asString(raw.description),
        thumbnailUrl: asString(raw.thumbnailUrl),
        imageUrls: asStringArray(raw.imageUrls),
        ...attachmentsFromDocument(raw),
        brochureUrls: asStringArray(raw.brochureUrls),
        tags: asStringArray(raw.tags),
        ...optionalInputString(raw, "externalUrl", "externalUrl"),
        specs: asStringRecord(raw.specs, [
          "companyName",
          "productName",
          "categoryLabel",
        ]),
      };
    case "partner_review":
      return {
        kind,
        ownerId: owner,
        promotionId: asString(raw.promotionId),
        productName: asString(raw.productName),
        category: asPartnerCategory(raw.category),
        brand: asString(raw.brand),
        modelName: asString(raw.modelName),
        features: asString(raw.features),
        reviewerName: asString(reviewer.name),
        ...optionalInputString(reviewer, "avatarUrl", "reviewerAvatarUrl"),
        ...optionalInputString(reviewer, "resumeUrl", "reviewerResumeUrl"),
        summary: asString(raw.summary),
        body: asString(raw.body),
        imageUrls: asStringArray(raw.imageUrls),
        ...attachmentsFromDocument(raw),
        tags: asStringArray(raw.tags),
        majorPros: asStringArray(raw.majorPros),
        baristaTip: asString(raw.baristaTip),
        ...optionalInputString(raw, "relatedUrl", "relatedUrl"),
      };
    case "partner_banner":
      return {
        kind,
        title: asString(raw.title),
        subtitle: asString(raw.subtitle),
        imageUrl: asString(raw.imageUrl),
        href: asString(raw.href),
        sortOrder: asNumber(raw.sortOrder),
        activeFrom: asString(raw.activeFrom),
        activeTo: asString(raw.activeTo),
      };
  }
}

export class AdminEventRequestMongoRepository implements EventRequestRepository {
  async list(
    query: AdminEventRequestListQuery,
  ): Promise<AdminEventRequestPage> {
    const db = await getMongoDb();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const filter: Filter<Document> = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            $or: ["title", "body", "requesterId"].map((key) => ({
              [key]: { $regex: escapeRegex(query.q!), $options: "i" },
            })),
          }
        : {}),
    };
    const collection = db.collection<Document>("community_event_requests");
    const [items, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ createdAt: -1, id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      collection.countDocuments(filter),
    ]);
    return {
      items: items.map(toEventRequestDto),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findRequestById(id: string) {
    const db = await getMongoDb();
    const value = await db
      .collection<Document>("community_event_requests")
      .findOne({ id });
    return value ? toEventRequestDto(value) : null;
  }

  async decidePending(
    id: string,
    decision: Parameters<EventRequestRepository["decidePending"]>[1],
    session: ClientSession,
  ) {
    const db = await getMongoDb();
    const value = await db
      .collection<Document>("community_event_requests")
      .findOneAndUpdate(
        { id, status: "pending" },
        { $set: decision },
        { returnDocument: "after", session },
      );
    return value ? toEventRequestDto(value) : null;
  }

  async createEvent(
    id: string,
    requestId: string,
    input: Extract<AdminContentInput, { kind: "community_event" }>,
    session: ClientSession,
  ) {
    const db = await getMongoDb();
    const now = new Date().toISOString();
    const document = {
      id,
      requestId,
      ...contentCreateFields(input),
      ...contentDefaults("community_event", now),
      moderationStatus: "active",
      updatedAt: now,
    };
    try {
      await db.collection("community_events").insertOne(document, { session });
    } catch (error) {
      if (isDuplicateKey(error))
        throw new AdminContentConflictError("이미 승인된 요청입니다.");
      throw error;
    }
    return toAdminContentDto("community_event", document);
  }
}

function toEventRequestDto(raw: Document): AdminEventRequestDto {
  return {
    id: asString(raw.id),
    requesterId: asString(raw.requesterId),
    title: asString(raw.title),
    body: asString(raw.body),
    ...optionalEventRequestCategory(raw.category),
    ...optionalInputString(raw, "applyUrl", "applyUrl"),
    ...optionalInputString(raw, "location", "location"),
    ...optionalInputString(raw, "address", "address"),
    ...optionalInputString(raw, "imageUrl", "imageUrl"),
    ...optionalInputString(raw, "schedule", "schedule"),
    ...optionalInputString(raw, "time", "time"),
    status:
      raw.status === "approved" || raw.status === "rejected"
        ? raw.status
        : "pending",
    createdAt: asString(raw.createdAt),
    ...optionalInputString(raw, "decidedAt", "decidedAt"),
    ...optionalInputString(raw, "decidedBy", "decidedBy"),
    ...optionalInputString(raw, "decisionReason", "decisionReason"),
    ...optionalInputString(raw, "eventId", "eventId"),
  };
}

function optionalEventRequestCategory(
  value: unknown,
): Pick<AdminEventRequestDto, "category"> {
  if (value === "official" || value === "seminar" || value === "meetup")
    return { category: value };
  return {};
}

export async function assertBannerSlotAvailable(
  db: Awaited<ReturnType<typeof getMongoDb>>,
  input: AdminContentInput,
  session: ClientSession,
  excludedId?: string,
) {
  if (input.kind !== "partner_banner") return;
  await db.collection("app_configs").updateOne(
    { key: `admin_partner_banner_slot:${input.sortOrder}` },
    {
      $set: {
        key: `admin_partner_banner_slot:${input.sortOrder}`,
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true, session },
  );
  const collision = await db
    .collection("partner_banners")
    .findOne(bannerSlotCollisionFilter(input, excludedId), { session });
  if (collision)
    throw new AdminContentConflictError(
      "같은 노출 순서의 배너 기간이 겹칩니다.",
    );
}

export function bannerSlotCollisionFilter(
  input: Extract<AdminContentInput, { kind: "partner_banner" }>,
  excludedId?: string,
) {
  return {
    ...(excludedId ? { id: { $ne: excludedId } } : {}),
    moderationStatus: { $ne: "deleted" },
    sortOrder: input.sortOrder,
    activeFrom: { $lt: input.activeTo },
    activeTo: { $gt: input.activeFrom },
  };
}

function pick<T extends object, K extends keyof T>(
  value: T,
  keys: readonly K[],
) {
  return Object.fromEntries(
    keys.flatMap((key) =>
      value[key] == null ? [] : [[key as string, value[key]]],
    ),
  );
}

function hasOwner(
  input: AdminContentInput,
): input is AdminContentInput & { ownerId: string } {
  return "ownerId" in input;
}

function assertKind(kind: AdminContentKind, input: AdminContentInput) {
  if (kind !== input.kind) throw new AdminContentInputError("kind mismatch");
}

function assertReactionKind(kind: AdminContentKind) {
  if (!REACTION_KINDS.has(kind))
    throw new AdminContentInputError("반응을 지원하지 않는 콘텐츠입니다.");
}

function toReactionDto(raw: Document): AdminContentReactionDto {
  const identityKey = asString(raw.identityKey);
  return {
    id: raw._id instanceof ObjectId ? raw._id.toHexString() : asString(raw._id),
    ...(identityKey.startsWith("user:")
      ? { userId: identityKey.slice("user:".length) }
      : {}),
    anonymous: !identityKey.startsWith("user:"),
    createdAt:
      raw.createdAt instanceof Date
        ? raw.createdAt.toISOString()
        : asString(raw.createdAt),
  };
}

function attachmentsFromDocument(raw: Document) {
  if (!Array.isArray(raw.attachments)) return {};
  return {
    attachments: raw.attachments.map((value) => {
      const item = asDocument(value);
      return {
        url: asString(item.url),
        name: asString(item.name),
        size: asNumber(item.size),
        contentType: asString(item.contentType),
      };
    }),
  };
}

function optionalDtoString(raw: Document, key: string) {
  const value = asOptionalString(raw[key]);
  return value ? { [key]: value } : {};
}

function optionalInputString(
  raw: Document,
  sourceKey: string,
  targetKey: string,
) {
  const value = asOptionalString(raw[sourceKey]);
  return value ? { [targetKey]: value } : {};
}

function asDocument(value: unknown): Document {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Document)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asStringRecord<const K extends string>(
  value: unknown,
  keys: readonly K[],
): Record<K, string> {
  const object = asDocument(value);
  return Object.fromEntries(
    keys.map((key) => [key, asString(object[key])]),
  ) as Record<K, string>;
}

function asState(value: unknown): AdminContentState {
  return value === "hidden" || value === "deleted" ? value : "active";
}

function asEventCategory(value: unknown) {
  return value === "seminar" || value === "meetup" ? value : "official";
}

function asRoast(value: unknown) {
  return value === "light" || value === "dark" ? value : "medium";
}

function asPartnerCategory(value: unknown) {
  const values = [
    "espresso-machine",
    "grinder",
    "ice-equipment",
    "brewing-roaster",
    "ingredient",
    "supplies",
  ] as const;
  return values.includes(value as (typeof values)[number])
    ? (value as (typeof values)[number])
    : "supplies";
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDuplicateKey(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}
