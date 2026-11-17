import { NextResponse, type NextRequest } from "next/server";
import {
  ACCOUNT_DELETION_BATCH_SIZE,
  processAccountDeletionJob,
  type AccountDeletionJob,
} from "@/application/member/accountDeletionJobs";
import { AccountDeletionJobsMongoRepository } from "@/infrastructure/mongodb/accountDeletionJobsMongoRepository";
import { AccountDeletionMongoRepository } from "@/infrastructure/mongodb/accountDeletionMongoRepository";
import {
  deleteOwnedUploadUrls,
  deletePrivateMemberUploadPrefix,
} from "@/infrastructure/server/r2";
import { jsonError } from "@/infrastructure/server/http";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";

export type AccountDeletionCronResult = {
  claimed: number;
  completed: number;
  retried: number;
  failed: number;
};

export type AccountDeletionCronDependencies = {
  claimDue(now: Date, limit: number): Promise<AccountDeletionJob[]>;
  process(job: AccountDeletionJob): Promise<"completed" | "retried" | "failed">;
  now(): Date;
  ensureIndexes(): Promise<void>;
};

const jobs = new AccountDeletionJobsMongoRepository();
const cleanupRepository = new AccountDeletionMongoRepository();

const productionDependencies: AccountDeletionCronDependencies = {
  claimDue: (now, limit) => jobs.claimDue(now, limit),
  process: (job) =>
    processAccountDeletionJob(
      {
        jobs,
        cleanupRepository,
        deleteLegacyUploads: deleteOwnedUploadUrls,
        deletePrivatePrefix: deletePrivateMemberUploadPrefix,
        now: () => new Date(),
      },
      job,
    ),
  now: () => new Date(),
  ensureIndexes: ensureMongoIndexes,
};

function isAuthorizedCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;
  return (
    Boolean(secret) &&
    request.headers.get("authorization") === `Bearer ${secret}`
  );
}

export function createAccountDeletionCronRoute(
  dependencies: AccountDeletionCronDependencies = productionDependencies,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request) => {
    if (!isAuthorizedCronRequest(request))
      return jsonError("권한이 없습니다.", 401);

    const startedAt = dependencies.now().getTime();
    const result: AccountDeletionCronResult = {
      claimed: 0,
      completed: 0,
      retried: 0,
      failed: 0,
    };
    try {
      await dependencies.ensureIndexes();
    } catch {
      return jsonError("탈퇴 작업을 처리할 수 없습니다.", 500);
    }
    while (
      result.claimed < ACCOUNT_DELETION_BATCH_SIZE &&
      dependencies.now().getTime() - startedAt < 50_000
    ) {
      const [job] = await dependencies.claimDue(dependencies.now(), 1);
      if (!job) break;
      result.claimed += 1;
      try {
        result[await dependencies.process(job)] += 1;
      } catch {
        result.retried += 1;
      }
    }

    return NextResponse.json(result);
  };
}

export const accountDeletionCronRoute: ReturnType<
  typeof createAccountDeletionCronRoute
> = createAccountDeletionCronRoute();
