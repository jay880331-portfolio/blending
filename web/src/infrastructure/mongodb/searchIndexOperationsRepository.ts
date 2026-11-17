import { randomUUID } from "node:crypto";
import type { SearchIndexRunDto } from "@blending/admin-contracts";
import type { Db } from "mongodb";
import type {
  SearchIndexOperationsRepository,
  SearchIndexTypeHealth,
} from "@/application/admin/searchIndexUseCases";
import type { MemberProfile } from "@/domain/member/types";
import type { SearchDocument, SearchDocumentType } from "@/domain/search/types";
import { publicContentFilter } from "@/infrastructure/mongodb/adminContentMongoRepository";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import {
  publicSearchSourceCollections,
  syncPublicSearchDocuments,
} from "@/infrastructure/mongodb/searchMongoRepository";
import { activeAccountFilter } from "@/infrastructure/server/accountStatus";
import type { UserDocument } from "@/infrastructure/server/auth";

const RUNS_COLLECTION = "search_index_runs";
const SEARCH_COLLECTION = "search_documents";
const LEASE_MS = 30 * 60 * 1000;
const SEARCH_TYPES = Object.keys(
  publicSearchSourceCollections,
) as SearchDocumentType[];

type SearchIndexRunDocument = SearchIndexRunDto & {
  actorId?: string;
  leaseExpiresAt: string;
};

export interface SearchIndexRunStore {
  expire(now: Date): Promise<void>;
  insert(document: SearchIndexRunDocument): Promise<boolean>;
  latest(): Promise<SearchIndexRunDocument | null>;
  finish(
    id: string,
    completion: Parameters<SearchIndexOperationsRepository["finish"]>[1],
  ): Promise<SearchIndexRunDocument>;
}

export function createSearchIndexOperationsRepository({
  store,
  inspect,
  reconcile,
}: {
  store: SearchIndexRunStore;
  inspect: SearchIndexOperationsRepository["inspect"];
  reconcile: SearchIndexOperationsRepository["reconcile"];
}): SearchIndexOperationsRepository {
  return {
    inspect,
    async latestRun() {
      const run = await store.latest();
      return run ? toDto(run) : null;
    },
    async start(trigger, actorId, now) {
      await store.expire(now);
      const document: SearchIndexRunDocument = {
        id: randomUUID(),
        trigger,
        status: "running",
        indexedCount: 0,
        deletedCount: 0,
        durationMs: 0,
        startedAt: now.toISOString(),
        completedAt: null,
        ...(actorId ? { actorId } : {}),
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS).toISOString(),
      };
      return (await store.insert(document)) ? toDto(document) : null;
    },
    reconcile,
    async finish(id, completion) {
      return toDto(await store.finish(id, completion));
    },
  };
}

function mongoRunStore(getDb: () => Promise<Db>): SearchIndexRunStore {
  return {
    async expire(now) {
      const db = await getDb();
      await db.collection<SearchIndexRunDocument>(RUNS_COLLECTION).updateMany(
        { status: "running", leaseExpiresAt: { $lte: now.toISOString() } },
        {
          $set: {
            status: "failed",
            completedAt: now.toISOString(),
            errorCode: "LEASE_EXPIRED",
          },
          $unset: { actorId: "", leaseExpiresAt: "" },
        },
      );
    },
    async insert(document) {
      const db = await getDb();
      try {
        await db
          .collection<SearchIndexRunDocument>(RUNS_COLLECTION)
          .insertOne(document);
        return true;
      } catch (error) {
        if (isDuplicateKey(error)) return false;
        throw error;
      }
    },
    async latest() {
      const db = await getDb();
      return db
        .collection<SearchIndexRunDocument>(RUNS_COLLECTION)
        .findOne({}, { sort: { startedAt: -1 }, projection: { _id: 0 } });
    },
    async finish(id, completion) {
      const db = await getDb();
      const run = await db
        .collection<SearchIndexRunDocument>(RUNS_COLLECTION)
        .findOneAndUpdate(
          { id, status: "running" },
          {
            $set: completion,
            $unset: { actorId: "", leaseExpiresAt: "" },
          },
          { returnDocument: "after", projection: { _id: 0 } },
        );
      if (!run) throw new Error("검색 인덱스 실행 이력을 찾을 수 없습니다.");
      return run;
    },
  };
}

async function inspectMongoSearchIndex(): Promise<SearchIndexTypeHealth[]> {
  const db = await getMongoDb();
  return Promise.all(
    SEARCH_TYPES.map(async (type) => {
      const [sourceIds, indexedIds] = await Promise.all([
        publicSourceIds(db, type),
        db.collection<SearchDocument>(SEARCH_COLLECTION).distinct("sourceId", {
          visibility: "public",
          sourceType: type,
        }) as Promise<string[]>,
      ]);
      return calculateSearchIndexTypeHealth(type, sourceIds, indexedIds);
    }),
  );
}

async function reconcileMongoSearchIndex() {
  const db = await getMongoDb();
  const before = new Set(
    await db.collection<SearchDocument>(SEARCH_COLLECTION).distinct("id", {
      visibility: "public",
      sourceType: { $in: SEARCH_TYPES },
    }),
  );
  const indexedCount = await syncPublicSearchDocuments();
  const after = new Set(
    await db.collection<SearchDocument>(SEARCH_COLLECTION).distinct("id", {
      visibility: "public",
      sourceType: { $in: SEARCH_TYPES },
    }),
  );
  return {
    indexedCount,
    deletedCount: [...before].filter((id) => !after.has(id)).length,
  };
}

async function publicSourceIds(db: Db, type: SearchDocumentType) {
  if (type !== "member_profile") {
    return db
      .collection(publicSearchSourceCollections[type])
      .distinct("id", publicContentFilter) as Promise<string[]>;
  }

  const profiles = await db
    .collection<MemberProfile & { ownerId?: string }>("member_profiles")
    .find({ isPortfolioPublic: { $ne: false } })
    .project<{ id: string; ownerId?: string }>({ _id: 0, id: 1, ownerId: 1 })
    .toArray();
  const activeOwnerIds = new Set(
    (await db.collection<UserDocument>("users").distinct("id", {
      id: { $in: profiles.map((profile) => profile.ownerId ?? profile.id) },
      ...activeAccountFilter(),
    })) as string[],
  );
  return profiles
    .filter((profile) => activeOwnerIds.has(profile.ownerId ?? profile.id))
    .map((profile) => profile.id);
}

export function calculateSearchIndexTypeHealth(
  type: string,
  sourceIds: string[],
  indexedIds: string[],
): SearchIndexTypeHealth {
  const source = new Set(sourceIds);
  const indexed = new Set(indexedIds);
  return {
    type,
    sourceCount: source.size,
    indexedCount: indexed.size,
    missingCount: [...source].filter((id) => !indexed.has(id)).length,
    orphanCount: [...indexed].filter((id) => !source.has(id)).length,
  };
}

function toDto(run: SearchIndexRunDocument): SearchIndexRunDto {
  return {
    id: run.id,
    trigger: run.trigger,
    status: run.status,
    indexedCount: run.indexedCount,
    deletedCount: run.deletedCount,
    durationMs: run.durationMs,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    ...(run.errorCode ? { errorCode: run.errorCode } : {}),
  };
}

function isDuplicateKey(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

export const searchIndexOperationsMongoRepository =
  createSearchIndexOperationsRepository({
    store: mongoRunStore(getMongoDb),
    inspect: inspectMongoSearchIndex,
    reconcile: reconcileMongoSearchIndex,
  });
