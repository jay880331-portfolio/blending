import type { AccountDeletionCleanupRepository } from "./accountDeletion";
import type { ClientSession } from "mongodb";

export const ACCOUNT_DELETION_LEASE_MS = 10 * 60 * 1_000;
export const ACCOUNT_DELETION_RETRY_MS = 10 * 60 * 1_000;
export const ACCOUNT_DELETION_DEADLINE_MS = 24 * 60 * 60 * 1_000;
export const ACCOUNT_DELETION_BATCH_SIZE = 20;

export type AccountDeletionJobStatus =
  | "pending"
  | "running"
  | "verifying"
  | "failed";

export type AccountDeletionErrorCode =
  | "r2_cleanup_failed"
  | "mongo_cleanup_failed"
  | "verification_failed";

export type AccountDeletionJob = {
  id: string;
  userId: string;
  withdrawnId: string;
  status: AccountDeletionJobStatus;
  attempts: number;
  cleanPasses: number;
  createdAt: Date;
  updatedAt: Date;
  nextAttemptAt: Date;
  deadlineAt: Date;
  leaseExpiresAt?: Date;
  lastErrorCode?: AccountDeletionErrorCode;
};

export type FailedAccountDeletionJobDto = Pick<
  AccountDeletionJob,
  | "id"
  | "status"
  | "attempts"
  | "createdAt"
  | "updatedAt"
  | "deadlineAt"
  | "lastErrorCode"
>;

export interface AccountDeletionJobRepository {
  prepare(userId: string, withdrawnId: string, now: Date): Promise<string>;
  claimById(id: string, now: Date): Promise<AccountDeletionJob | null>;
  claimDue(now: Date, limit: number): Promise<AccountDeletionJob[]>;
  save(
    claimedJob: AccountDeletionJob,
    nextJob: AccountDeletionJob,
  ): Promise<boolean>;
  complete(job: AccountDeletionJob): Promise<boolean>;
  listFailed(): Promise<FailedAccountDeletionJobDto[]>;
  retryFailed(id: string, now: Date, session?: ClientSession): Promise<boolean>;
}

export type AccountDeletionWorkerDependencies = {
  jobs: AccountDeletionJobRepository;
  cleanupRepository: AccountDeletionCleanupRepository;
  deleteLegacyUploads(urls: string[]): Promise<void>;
  deletePrivatePrefix(userId: string): Promise<number>;
  now(): Date;
};

export type CleanupObservation = {
  mongoResidualCount: number;
  r2ResidualCount: number;
};

export function nextDeletionJobState(
  job: AccountDeletionJob,
  observation: CleanupObservation | AccountDeletionErrorCode,
  now: Date,
): { action: "complete" } | { action: "save"; job: AccountDeletionJob } {
  const errorCode =
    typeof observation === "string"
      ? observation
      : observation.mongoResidualCount > 0 || observation.r2ResidualCount > 0
        ? "verification_failed"
        : undefined;

  if (now >= job.deadlineAt) {
    return save(job, now, "failed", job.cleanPasses, errorCode, now);
  }
  if (errorCode) {
    return save(
      job,
      now,
      "verifying",
      typeof observation === "string" ? job.cleanPasses : 0,
      errorCode,
      retryAt(now, job.deadlineAt),
    );
  }
  if (job.cleanPasses >= 1) return { action: "complete" };
  return save(
    job,
    now,
    "verifying",
    1,
    undefined,
    retryAt(now, job.deadlineAt),
  );
}

export async function processAccountDeletionJob(
  dependencies: AccountDeletionWorkerDependencies,
  job: AccountDeletionJob,
): Promise<"completed" | "retried" | "failed"> {
  const startedAt = dependencies.now();
  if (startedAt >= job.deadlineAt) {
    const next = nextDeletionJobState(job, "verification_failed", startedAt);
    if (next.action === "complete") return "retried";
    if (!(await dependencies.jobs.save(job, next.job))) return "retried";
    return "failed";
  }
  let observation: CleanupObservation | AccountDeletionErrorCode;

  try {
    const result = await dependencies.cleanupRepository.observe(job.userId);
    observation = {
      mongoResidualCount: result.residualCount,
      r2ResidualCount: result.legacyUploadUrls.length,
    };
    try {
      await dependencies.deleteLegacyUploads(result.legacyUploadUrls);
      observation.r2ResidualCount += await dependencies.deletePrivatePrefix(
        job.userId,
      );
    } catch {
      observation = "r2_cleanup_failed";
    }
  } catch {
    observation = "mongo_cleanup_failed";
  }

  if (
    observation !== "r2_cleanup_failed" &&
    observation !== "mongo_cleanup_failed"
  ) {
    try {
      await dependencies.cleanupRepository.cleanup(job.userId, job.withdrawnId);
    } catch {
      observation = "mongo_cleanup_failed";
    }
  }

  const next = nextDeletionJobState(job, observation, dependencies.now());
  if (next.action === "complete")
    return (await dependencies.jobs.complete(job)) ? "completed" : "retried";
  if (!(await dependencies.jobs.save(job, next.job))) return "retried";
  return next.job.status === "failed" ? "failed" : "retried";
}

export async function processAccountDeletionJobById(
  dependencies: AccountDeletionWorkerDependencies,
  id: string,
): Promise<"not_claimed" | "completed" | "retried" | "failed"> {
  const job = await dependencies.jobs.claimById(id, dependencies.now());
  if (!job) return "not_claimed";
  return processAccountDeletionJob(dependencies, job);
}

function save(
  job: AccountDeletionJob,
  now: Date,
  status: AccountDeletionJobStatus,
  cleanPasses: number,
  lastErrorCode: AccountDeletionErrorCode | undefined,
  nextAttemptAt: Date,
) {
  const next = { ...job };
  delete next.leaseExpiresAt;
  delete next.lastErrorCode;
  return {
    action: "save" as const,
    job: {
      ...next,
      status,
      attempts: job.attempts + 1,
      cleanPasses,
      createdAt: new Date(job.createdAt),
      updatedAt: new Date(now),
      nextAttemptAt: new Date(nextAttemptAt),
      deadlineAt: new Date(job.deadlineAt),
      ...(lastErrorCode ? { lastErrorCode } : {}),
    },
  };
}

function retryAt(now: Date, deadlineAt: Date) {
  return new Date(
    Math.min(now.getTime() + ACCOUNT_DELETION_RETRY_MS, deadlineAt.getTime()),
  );
}
