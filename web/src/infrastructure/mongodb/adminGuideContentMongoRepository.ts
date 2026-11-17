import type {
  GuideContentDto,
  GuideContentInput,
  GuideContentKind,
  GuideContentListQuery,
  GuideContentPage,
} from "@blending/admin-contracts";
import type { ClientSession, Document, Filter } from "mongodb";
import { getMongoDb } from "./client";

export const GUIDE_CONTENT_COLLECTIONS: Record<GuideContentKind, string> = {
  notice: "content_notices",
  faq: "content_faqs",
  policy: "content_policies",
};

export function publicGuideContentFilter(now: Date): Filter<Document> {
  return {
    status: "published",
    deletedAt: { $exists: false },
    publishedAt: { $lte: now.toISOString() },
  };
}

export function guideContentListFilter(
  query: Pick<GuideContentListQuery, "status" | "deleted" | "q">,
): Filter<Document> {
  return {
    ...(query.status ? { status: query.status } : {}),
    deletedAt: { $exists: query.deleted ?? false },
    ...(query.q ? { $text: { $search: query.q } } : {}),
  };
}

export function guideContentUpdateFilter(id: string): Filter<Document> {
  return { id, deletedAt: { $exists: false } };
}

export function sortPublicFaqs<T extends { id: string; sortOrder: number }>(
  items: T[],
) {
  return [...items].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  );
}

export class AdminGuideContentMongoRepository {
  async list(
    kind: GuideContentKind,
    query: GuideContentListQuery,
  ): Promise<GuideContentPage> {
    const db = await getMongoDb();
    const collection = db.collection<Document>(GUIDE_CONTENT_COLLECTIONS[kind]);
    const filter = guideContentListFilter(query);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const direction = query.direction === "asc" ? 1 : -1;
    const [items, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ [query.sort ?? "updatedAt"]: direction, id: direction })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      collection.countDocuments(filter),
    ]);
    return {
      items: items.map((item) => toGuideContentDto(kind, item)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findById(kind: GuideContentKind, id: string) {
    const db = await getMongoDb();
    const value = await db
      .collection<Document>(GUIDE_CONTENT_COLLECTIONS[kind])
      .findOne({ id });
    return value ? toGuideContentDto(kind, value) : null;
  }

  async create(
    kind: GuideContentKind,
    id: string,
    input: GuideContentInput,
    actorId: string,
    session: ClientSession,
  ) {
    const db = await getMongoDb();
    const now = new Date().toISOString();
    const document = {
      id,
      ...input,
      createdAt: now,
      updatedAt: now,
      createdBy: actorId,
      updatedBy: actorId,
    };
    await db
      .collection(GUIDE_CONTENT_COLLECTIONS[kind])
      .insertOne(document, { session });
    return toGuideContentDto(kind, document);
  }

  async update(
    kind: GuideContentKind,
    id: string,
    input: GuideContentInput,
    actorId: string,
    session: ClientSession,
  ) {
    const db = await getMongoDb();
    const collection = db.collection<Document>(GUIDE_CONTENT_COLLECTIONS[kind]);
    const result = await collection.updateOne(
      guideContentUpdateFilter(id),
      {
        $set: {
          ...input,
          updatedAt: new Date().toISOString(),
          updatedBy: actorId,
        },
        $unset: input.publishedAt ? {} : { publishedAt: "" },
      },
      { session },
    );
    if (!result.matchedCount) return null;
    const updated = await collection.findOne({ id }, { session });
    return updated ? toGuideContentDto(kind, updated) : null;
  }

  async changeDeleted(
    kind: GuideContentKind,
    id: string,
    deleted: boolean,
    actorId: string,
    session: ClientSession,
  ) {
    const db = await getMongoDb();
    const now = new Date().toISOString();
    const result = await db
      .collection<Document>(GUIDE_CONTENT_COLLECTIONS[kind])
      .findOneAndUpdate(
        { id, deletedAt: { $exists: !deleted } },
        deleted
          ? { $set: { deletedAt: now, updatedAt: now, updatedBy: actorId } }
          : {
              $unset: { deletedAt: "" },
              $set: { updatedAt: now, updatedBy: actorId },
            },
        { returnDocument: "after", session },
      );
    return result ? toGuideContentDto(kind, result) : null;
  }

  async listPublic(kind: "notice" | "faq", now: Date) {
    const db = await getMongoDb();
    const documents = await db
      .collection<Document>(GUIDE_CONTENT_COLLECTIONS[kind])
      .find(publicGuideContentFilter(now))
      .sort(
        kind === "faq" ? { sortOrder: 1, id: 1 } : { publishedAt: -1, id: -1 },
      )
      .toArray();
    return documents.map((item) => toGuideContentDto(kind, item));
  }

  async findPublicPolicy(slug: string, now: Date) {
    const db = await getMongoDb();
    const value = await db
      .collection<Document>(GUIDE_CONTENT_COLLECTIONS.policy)
      .findOne(
        {
          ...publicGuideContentFilter(now),
          slug,
          effectiveAt: { $lte: now.toISOString() },
        },
        { sort: { version: -1 } },
      );
    return value ? toGuideContentDto("policy", value) : null;
  }
}

export function toGuideContentDto(
  kind: GuideContentKind,
  value: Document,
): GuideContentDto {
  const fields =
    kind === "notice"
      ? ["title", "body", "status", "publishedAt"]
      : kind === "faq"
        ? [
            "category",
            "question",
            "answer",
            "sortOrder",
            "status",
            "publishedAt",
          ]
        : [
            "slug",
            "title",
            "body",
            "version",
            "effectiveAt",
            "status",
            "publishedAt",
          ];
  const data = Object.fromEntries(
    fields.flatMap((field) =>
      value[field] === undefined ? [] : [[field, value[field]]],
    ),
  ) as GuideContentInput;
  return {
    id: String(value.id),
    kind,
    status: value.status,
    ...(value.publishedAt ? { publishedAt: String(value.publishedAt) } : {}),
    createdAt: String(value.createdAt),
    updatedAt: String(value.updatedAt),
    ...(value.deletedAt ? { deletedAt: String(value.deletedAt) } : {}),
    createdBy: String(value.createdBy),
    updatedBy: String(value.updatedBy),
    data,
  } as GuideContentDto;
}
