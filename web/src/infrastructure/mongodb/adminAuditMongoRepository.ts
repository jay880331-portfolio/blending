import { randomUUID } from "node:crypto";
import type {
  AdminAuditListQuery,
  AdminAuditLogDto,
} from "@blending/admin-contracts";
import type { ClientSession, Filter, Sort } from "mongodb";
import type { AdminAuditRepository } from "@/application/admin/adminUnitOfWork";
import { getMongoDb } from "@/infrastructure/mongodb/client";

const AUDIT_COLLECTION = "admin_audit_logs";
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const SORT_FIELDS = new Set([
  "action",
  "actorName",
  "createdAt",
  "resourceType",
]);

type AuditCursor = {
  sort(sort: Sort): AuditCursor;
  skip(count: number): AuditCursor;
  limit(count: number): AuditCursor;
  toArray(): Promise<AdminAuditLogDto[]>;
};

type AuditCollection = {
  insertOne(
    document: AdminAuditLogDto,
    options: { session: ClientSession },
  ): Promise<unknown>;
  find(
    filter: Filter<AdminAuditLogDto>,
    options: { projection: { _id: 0 } },
  ): AuditCursor;
  countDocuments(filter: Filter<AdminAuditLogDto>): Promise<number>;
  findOne(
    filter: Filter<AdminAuditLogDto>,
    options: { projection: { _id: 0 } },
  ): Promise<AdminAuditLogDto | null>;
};

type GetAuditCollection = () => Promise<AuditCollection>;

async function getAuditCollection(): Promise<AuditCollection> {
  const db = await getMongoDb();
  return db.collection<AdminAuditLogDto>(AUDIT_COLLECTION);
}

export function createAdminAuditMongoRepository(
  getCollection: GetAuditCollection = getAuditCollection,
): AdminAuditRepository {
  return {
    async append(input, session) {
      const collection = await getCollection();
      await collection.insertOne(
        {
          ...input,
          id: randomUUID(),
          createdAt: new Date().toISOString(),
        },
        { session },
      );
    },

    async list(query) {
      const collection = await getCollection();
      const page = query.page ?? DEFAULT_PAGE;
      const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
      const filter = toAuditFilter(query);
      const sort = toAuditSort(query);
      const [items, total] = await Promise.all([
        collection
          .find(filter, { projection: { _id: 0 } })
          .sort(sort)
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .toArray(),
        collection.countDocuments(filter),
      ]);

      return {
        items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    },

    async findById(id) {
      const collection = await getCollection();
      return collection.findOne({ id }, { projection: { _id: 0 } });
    },
  };
}

export const adminAuditMongoRepository = createAdminAuditMongoRepository();

function toAuditFilter(query: AdminAuditListQuery): Filter<AdminAuditLogDto> {
  const filter: Filter<AdminAuditLogDto> = {};

  if (query.q) {
    const escapedQuery = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const containsQuery = { $regex: escapedQuery, $options: "i" };
    filter.$or = [
      { actorName: containsQuery },
      { action: containsQuery },
      { resourceType: containsQuery },
      { resourceId: containsQuery },
      { requestId: containsQuery },
    ];
  }
  if (query.status) {
    filter.action = query.status as AdminAuditLogDto["action"];
  }
  if (query.action) filter.action = query.action;
  if (query.actorId) filter.actorId = query.actorId;
  if (query.resourceType) filter.resourceType = query.resourceType;
  if (query.resourceId) filter.resourceId = query.resourceId;
  if (query.from || query.to) {
    filter.createdAt = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }

  return filter;
}

function toAuditSort(query: AdminAuditListQuery): Sort {
  const field =
    query.sort && SORT_FIELDS.has(query.sort) ? query.sort : "createdAt";
  const direction = query.direction === "asc" ? 1 : -1;
  return { [field]: direction, id: direction };
}
