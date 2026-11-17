import assert from "node:assert/strict";
import test from "node:test";
import {
  nextDeletionJobState,
  processAccountDeletionJob,
  processAccountDeletionJobById,
  type AccountDeletionJob,
  type AccountDeletionErrorCode,
  type AccountDeletionWorkerDependencies,
  type CleanupObservation,
} from "./accountDeletionJobs";

const now = new Date("2026-08-21T12:00:00.000Z");

function job(overrides: Partial<AccountDeletionJob> = {}): AccountDeletionJob {
  return {
    id: "job-1",
    userId: "user-1",
    withdrawnId: "withdrawn-1",
    status: "running",
    attempts: 2,
    cleanPasses: 0,
    createdAt: new Date("2026-08-21T11:00:00.000Z"),
    updatedAt: new Date("2026-08-21T11:50:00.000Z"),
    nextAttemptAt: now,
    deadlineAt: new Date("2026-08-22T11:00:00.000Z"),
    leaseExpiresAt: new Date("2026-08-21T12:10:00.000Z"),
    ...overrides,
  };
}

function savedJob(overrides: Partial<AccountDeletionJob> = {}) {
  const saved = job(overrides);
  delete saved.leaseExpiresAt;
  return saved;
}

function worker(
  overrides: Omit<Partial<AccountDeletionWorkerDependencies>, "jobs"> & {
    jobs?: Partial<AccountDeletionWorkerDependencies["jobs"]>;
  } = {},
) {
  const { jobs: jobOverrides, ...dependencyOverrides } = overrides;
  const calls: string[] = [];
  const jobs = {
    prepare: async () => "job-1",
    claimById: async () => null,
    claimDue: async () => [],
    save: async () => true,
    complete: async () => true,
    listFailed: async () => [],
    retryFailed: async () => true,
    ...jobOverrides,
  };
  return {
    calls,
    dependencies: {
      jobs,
      cleanupRepository: {
        observe: async () => {
          calls.push("observe");
          return { residualCount: 0, legacyUploadUrls: ["legacy-url"] };
        },
        cleanup: async () => {
          calls.push("mongo");
        },
      },
      deleteLegacyUploads: async () => {
        calls.push("legacy");
      },
      deletePrivatePrefix: async () => {
        calls.push("private");
        return 0;
      },
      now: () => now,
      ...dependencyOverrides,
    } satisfies AccountDeletionWorkerDependencies,
  };
}

test("observes before deleting legacy, private, and Mongo data", async () => {
  const { calls, dependencies } = worker();

  assert.equal(await processAccountDeletionJob(dependencies, job()), "retried");
  assert.deepEqual(calls, ["observe", "legacy", "private", "mongo"]);
});

test("fails an expired claimed job before invoking cleanup", async () => {
  let saved: AccountDeletionJob | undefined;
  const { calls, dependencies } = worker({
    now: () => new Date("2026-08-22T11:00:00.000Z"),
    jobs: { save: async (_claimed, next) => ((saved = next), true) },
  });
  assert.equal(
    await processAccountDeletionJob(
      dependencies,
      job({ deadlineAt: new Date("2026-08-22T11:00:00.000Z") }),
    ),
    "failed",
  );
  assert.deepEqual(calls, []);
  assert.equal(saved?.status, "failed");
});

test("uses observed residuals to schedule verification", async () => {
  let saved: AccountDeletionJob | undefined;
  const { dependencies } = worker({
    cleanupRepository: {
      observe: async () => ({ residualCount: 1, legacyUploadUrls: [] }),
      cleanup: async () => {},
    },
    jobs: { save: async (_claimed, next) => ((saved = next), true) },
  });

  assert.equal(await processAccountDeletionJob(dependencies, job()), "retried");
  assert.equal(saved?.lastErrorCode, "verification_failed");
  assert.equal(saved?.cleanPasses, 0);
});

test("classifies R2 cleanup errors without persisting error details", async () => {
  let saved: AccountDeletionJob | undefined;
  const { dependencies } = worker({
    deletePrivatePrefix: async () => {
      throw new Error("private/member-1.jpg");
    },
    jobs: { save: async (_claimed, next) => ((saved = next), true) },
  });

  assert.equal(await processAccountDeletionJob(dependencies, job()), "retried");
  assert.equal(saved?.lastErrorCode, "r2_cleanup_failed");
});

test("classifies Mongo cleanup errors", async () => {
  let saved: AccountDeletionJob | undefined;
  const { dependencies } = worker({
    cleanupRepository: {
      observe: async () => ({ residualCount: 0, legacyUploadUrls: [] }),
      cleanup: async () => {
        throw new Error("member-1");
      },
    },
    jobs: { save: async (_claimed, next) => ((saved = next), true) },
  });

  assert.equal(await processAccountDeletionJob(dependencies, job()), "retried");
  assert.equal(saved?.lastErrorCode, "mongo_cleanup_failed");
});

test("completes after two clean passes and treats a stale completion lease as retried", async () => {
  let completeCalls = 0;
  const { dependencies } = worker({
    cleanupRepository: {
      observe: async () => ({ residualCount: 0, legacyUploadUrls: [] }),
      cleanup: async () => {},
    },
    jobs: {
      complete: async () => (++completeCalls, false),
    },
  });

  assert.equal(
    await processAccountDeletionJob(dependencies, job({ cleanPasses: 1 })),
    "retried",
  );
  assert.equal(completeCalls, 1);
});

test("treats a stale save lease as retried", async () => {
  const { dependencies } = worker({
    jobs: { save: async () => false },
  });

  assert.equal(await processAccountDeletionJob(dependencies, job()), "retried");
});

test("persists the first clean pass and completes a later claimed pass", async () => {
  let saved: AccountDeletionJob | undefined;
  let completed = 0;
  const { dependencies } = worker({
    cleanupRepository: {
      observe: async () => ({ residualCount: 0, legacyUploadUrls: [] }),
      cleanup: async () => {},
    },
    jobs: {
      save: async (_claimed, next) => ((saved = next), true),
      complete: async () => (++completed, true),
    },
  });

  assert.equal(await processAccountDeletionJob(dependencies, job()), "retried");
  assert.equal(saved?.cleanPasses, 1);
  assert.equal(
    await processAccountDeletionJob(
      dependencies,
      job({ ...saved, status: "running", leaseExpiresAt: now }),
    ),
    "completed",
  );
  assert.equal(completed, 1);
});

test("late private Mongo and R2 data reset verification before two clean passes complete", async () => {
  let lateMongoDocument = false;
  let latePrivatePrefixKey = false;
  const privatePrefixUserIds: string[] = [];
  let current = job();
  const { dependencies } = worker({
    cleanupRepository: {
      observe: async () => ({
        residualCount: lateMongoDocument ? 1 : 0,
        legacyUploadUrls: [],
      }),
      cleanup: async () => {
        lateMongoDocument = false;
      },
    },
    deletePrivatePrefix: async (userId) => {
      privatePrefixUserIds.push(userId);
      const deleted = Number(latePrivatePrefixKey);
      latePrivatePrefixKey = false;
      return deleted;
    },
    jobs: {
      save: async (_claimed, next) => ((current = next), true),
      complete: async () => true,
    },
  });
  const run = async () => {
    const result = await processAccountDeletionJob(
      dependencies,
      job({ ...current, status: "running", leaseExpiresAt: now }),
    );
    return result;
  };

  assert.equal(await run(), "retried");
  assert.equal(current.cleanPasses, 1);

  lateMongoDocument = true;
  latePrivatePrefixKey = true;
  privatePrefixUserIds.length = 0;
  assert.equal(await run(), "retried");
  assert.equal(current.cleanPasses, 0);
  assert.deepEqual(privatePrefixUserIds, ["user-1"]);
  assert.equal(lateMongoDocument, false);
  assert.equal(latePrivatePrefixKey, false);

  assert.equal(await run(), "retried");
  assert.equal(current.cleanPasses, 1);
  assert.equal(await run(), "completed");
});

test("a late private R2 key alone resets verification before two clean passes complete", async () => {
  let latePrivatePrefixKey = false;
  const privatePrefixUserIds: string[] = [];
  let current = job();
  const { dependencies } = worker({
    cleanupRepository: {
      observe: async () => ({ residualCount: 0, legacyUploadUrls: [] }),
      cleanup: async () => {},
    },
    deletePrivatePrefix: async (userId) => {
      privatePrefixUserIds.push(userId);
      const deleted = Number(latePrivatePrefixKey);
      latePrivatePrefixKey = false;
      return deleted;
    },
    jobs: {
      save: async (_claimed, next) => ((current = next), true),
      complete: async () => true,
    },
  });
  const run = () =>
    processAccountDeletionJob(
      dependencies,
      job({ ...current, status: "running", leaseExpiresAt: now }),
    );

  assert.equal(await run(), "retried");
  assert.equal(current.cleanPasses, 1);

  latePrivatePrefixKey = true;
  privatePrefixUserIds.length = 0;
  assert.equal(await run(), "retried");
  assert.equal(current.cleanPasses, 0);
  assert.deepEqual(privatePrefixUserIds, ["user-1"]);
  assert.equal(latePrivatePrefixKey, false);

  assert.equal(await run(), "retried");
  assert.equal(current.cleanPasses, 1);
  assert.equal(await run(), "completed");
});

test("claims a job once before processing by ID", async () => {
  let claimCalls = 0;
  const { dependencies } = worker({
    jobs: {
      claimById: async () => (++claimCalls === 1 ? job() : null),
    },
  });

  assert.equal(
    await processAccountDeletionJobById(dependencies, "job-1"),
    "retried",
  );
  assert.equal(
    await processAccountDeletionJobById(dependencies, "job-1"),
    "not_claimed",
  );
});

test("residual cleanup results reset clean passes and retry after ten minutes", () => {
  const result = nextDeletionJobState(
    job({ cleanPasses: 1 }),
    { mongoResidualCount: 1, r2ResidualCount: 0 },
    now,
  );

  assert.deepEqual(result, {
    action: "save",
    job: {
      ...savedJob({ cleanPasses: 1 }),
      status: "verifying",
      attempts: 3,
      cleanPasses: 0,
      updatedAt: now,
      nextAttemptAt: new Date("2026-08-21T12:10:00.000Z"),
      lastErrorCode: "verification_failed",
    },
  });
  assert.equal("leaseExpiresAt" in result.job, false);
});

test("first zero-residual pass is saved for independent verification", () => {
  const result = nextDeletionJobState(
    job(),
    { mongoResidualCount: 0, r2ResidualCount: 0 },
    now,
  );

  assert.deepEqual(result, {
    action: "save",
    job: {
      ...savedJob(),
      status: "verifying",
      attempts: 3,
      cleanPasses: 1,
      updatedAt: now,
      nextAttemptAt: new Date("2026-08-21T12:10:00.000Z"),
    },
  });
  assert.equal("leaseExpiresAt" in result.job, false);
  assert.equal("lastErrorCode" in result.job, false);
});

test("second zero-residual pass completes the job", () => {
  assert.deepEqual(
    nextDeletionJobState(
      job({ cleanPasses: 1 }),
      { mongoResidualCount: 0, r2ResidualCount: 0 },
      now,
    ),
    { action: "complete" },
  );
});

test("fixed cleanup errors retain clean passes and retry after ten minutes", () => {
  const error: AccountDeletionErrorCode = "mongo_cleanup_failed";
  const result = nextDeletionJobState(job({ cleanPasses: 1 }), error, now);

  assert.deepEqual(result, {
    action: "save",
    job: {
      ...savedJob({ cleanPasses: 1 }),
      status: "verifying",
      attempts: 3,
      updatedAt: now,
      nextAttemptAt: new Date("2026-08-21T12:10:00.000Z"),
      lastErrorCode: error,
    },
  });
  assert.equal("leaseExpiresAt" in result.job, false);
});

test("saved jobs do not share Date objects with caller-owned input", () => {
  const input = job();
  const inputNow = new Date("2026-08-21T12:00:00.000Z");
  const result = nextDeletionJobState(
    input,
    { mongoResidualCount: 0, r2ResidualCount: 0 },
    inputNow,
  );
  assert.equal(result.action, "save");

  assert.notEqual(result.job.createdAt, input.createdAt);
  assert.notEqual(result.job.deadlineAt, input.deadlineAt);
  assert.notEqual(result.job.updatedAt, inputNow);
  assert.notEqual(result.job.nextAttemptAt, input.nextAttemptAt);
  input.createdAt.setTime(0);
  input.deadlineAt.setTime(0);
  input.nextAttemptAt.setTime(0);
  inputNow.setTime(0);
  assert.equal(result.job.createdAt.toISOString(), "2026-08-21T11:00:00.000Z");
  assert.equal(result.job.deadlineAt.toISOString(), "2026-08-22T11:00:00.000Z");
  assert.equal(result.job.updatedAt.toISOString(), "2026-08-21T12:00:00.000Z");
  assert.equal(
    result.job.nextAttemptAt.toISOString(),
    "2026-08-21T12:10:00.000Z",
  );
});

test("retry timing never exceeds the deletion deadline", () => {
  const deadlineAt = new Date("2026-08-22T11:00:00.000Z");
  const result = nextDeletionJobState(
    job({ deadlineAt }),
    "r2_cleanup_failed",
    new Date("2026-08-22T10:55:00.000Z"),
  );
  assert.equal(result.action, "save");
  assert.equal(result.job.status, "verifying");
  assert.equal(
    result.job.nextAttemptAt.toISOString(),
    "2026-08-22T11:00:00.000Z",
  );
});

test("residuals and errors at the deadline fail without a lease", () => {
  const atDeadline = new Date("2026-08-22T11:00:00.000Z");
  const cases: Array<CleanupObservation | AccountDeletionErrorCode> = [
    { mongoResidualCount: 0, r2ResidualCount: 1 },
    "r2_cleanup_failed",
  ];

  for (const observation of cases) {
    const result = nextDeletionJobState(
      job({ deadlineAt: atDeadline }),
      observation,
      atDeadline,
    );
    assert.equal(result.action, "save");
    assert.equal(result.job.status, "failed");
    assert.equal(result.job.attempts, 3);
    assert.equal(result.job.updatedAt.getTime(), atDeadline.getTime());
    assert.equal("leaseExpiresAt" in result.job, false);
  }
});
