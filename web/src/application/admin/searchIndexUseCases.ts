import type {
  SearchIndexHealthDto,
  SearchIndexRunDto,
  SearchIndexRunStatus,
  SearchIndexRunTrigger,
} from "@blending/admin-contracts";
import { searchIndexOperationsMongoRepository } from "@/infrastructure/mongodb/searchIndexOperationsRepository";

export type SearchIndexTypeHealth = SearchIndexHealthDto["byType"][number];

export interface SearchIndexOperationsRepository {
  inspect(): Promise<SearchIndexTypeHealth[]>;
  latestRun(): Promise<SearchIndexRunDto | null>;
  start(
    trigger: SearchIndexRunTrigger,
    actorId: string | undefined,
    now: Date,
  ): Promise<SearchIndexRunDto | null>;
  reconcile(): Promise<{ indexedCount: number; deletedCount: number }>;
  finish(
    id: string,
    completion: Pick<
      SearchIndexRunDto,
      | "status"
      | "indexedCount"
      | "deletedCount"
      | "durationMs"
      | "completedAt"
      | "errorCode"
    >,
  ): Promise<SearchIndexRunDto>;
}

export class SearchIndexBusyError extends Error {
  constructor() {
    super("검색 인덱스 정합성 작업이 이미 실행 중입니다.");
  }
}

export async function inspectSearchIndex(
  repository: SearchIndexOperationsRepository = searchIndexOperationsMongoRepository,
  now = new Date(),
): Promise<SearchIndexHealthDto> {
  const [byType, latestRun] = await Promise.all([
    repository.inspect(),
    repository.latestRun(),
  ]);
  return { checkedAt: now.toISOString(), byType, latestRun };
}

export async function reconcileSearchIndex(
  trigger: SearchIndexRunTrigger,
  actorId?: string,
  repository: SearchIndexOperationsRepository = searchIndexOperationsMongoRepository,
  now = new Date(),
): Promise<SearchIndexRunDto> {
  const run = await repository.start(trigger, actorId, now);
  if (!run) throw new SearchIndexBusyError();

  try {
    const result = await repository.reconcile();
    return repository.finish(
      run.id,
      completion("succeeded", result, now, new Date()),
    );
  } catch (error) {
    await repository.finish(
      run.id,
      completion(
        "failed",
        { indexedCount: 0, deletedCount: 0 },
        now,
        new Date(),
        "RECONCILE_FAILED",
      ),
    );
    throw error;
  }
}

function completion(
  status: SearchIndexRunStatus,
  counts: { indexedCount: number; deletedCount: number },
  startedAt: Date,
  completedAt: Date,
  errorCode?: SearchIndexRunDto["errorCode"],
) {
  return {
    status,
    ...counts,
    durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
    completedAt: completedAt.toISOString(),
    ...(errorCode ? { errorCode } : {}),
  };
}
