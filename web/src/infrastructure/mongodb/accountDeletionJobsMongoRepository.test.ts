import assert from "node:assert/strict";
import test from "node:test";
import type { AccountDeletionJob } from "@/application/member/accountDeletionJobs";
import { AccountDeletionJobsMongoRepository } from "./accountDeletionJobsMongoRepository";

const NOW = new Date("2026-08-21T00:00:00.000Z");

type User = Record<string, unknown> & { id: string; accountStatus?: string };

function job(overrides: Partial<AccountDeletionJob> = {}): AccountDeletionJob {
  return {
    id: "job-1",
    userId: "user-1",
    withdrawnId: "withdrawn-1",
    status: "pending",
    attempts: 2,
    cleanPasses: 1,
    createdAt: new Date("2026-08-20T00:00:00.000Z"),
    updatedAt: new Date("2026-08-20T00:00:00.000Z"),
    nextAttemptAt: new Date("2026-08-20T00:00:00.000Z"),
    deadlineAt: new Date("2026-08-22T00:00:00.000Z"),
    ...overrides,
  };
}

function createStore(
  options: {
    user?: User;
    jobs?: AccountDeletionJob[];
    failJobInsert?: boolean;
  } = {},
) {
  const store = {
    users: options.user ? [structuredClone(options.user)] : [],
    phoneVerifications: [{ phone: "01012345678" }, { phone: "other" }],
    pendingSocialSignups: [
      { profile: { provider: "kakao", providerId: "social-1" } },
      { profile: { provider: "naver", providerId: "other" } },
    ],
    jobs: (options.jobs ?? []).map((item) => structuredClone(item)),
  };
  const snapshot = () => structuredClone(store);
  const restore = (value: typeof store) => Object.assign(store, value);
  const session = {
    withTransaction: async <T>(work: () => Promise<T>) => {
      const before = snapshot();
      try {
        return await work();
      } catch (error) {
        restore(before);
        throw error;
      }
    },
    endSession: async () => undefined,
  };
  const matchesClaim = (
    item: AccountDeletionJob,
    filter: Record<string, unknown>,
  ) => {
    if (filter.id !== undefined && item.id !== filter.id) return false;
    return (filter.$or as Array<Record<string, Record<string, unknown>>>).some(
      (condition) => {
        if ((condition.status as unknown) === "running")
          return (
            item.status === "running" &&
            item.leaseExpiresAt !== undefined &&
            item.leaseExpiresAt <= (condition.leaseExpiresAt.$lte as Date)
          );
        return (
          (condition.status.$in as string[]).includes(item.status) &&
          item.nextAttemptAt <= (condition.nextAttemptAt.$lte as Date)
        );
      },
    );
  };
  const db = {
    collection(name: string) {
      if (name === "users")
        return {
          findOne: async (filter: { id: string }) =>
            structuredClone(
              store.users.find((item) => item.id === filter.id) ?? null,
            ),
          findOneAndUpdate: async (
            filter: { id: string },
            update: {
              $set: Record<string, unknown>;
              $unset: Record<string, "">;
            },
          ) => {
            const user = store.users.find(
              (item) =>
                item.id === filter.id && item.accountStatus === "active",
            );
            if (!user) return null;
            Object.assign(user, update.$set);
            for (const field of Object.keys(update.$unset)) delete user[field];
            return structuredClone(user);
          },
        };
      if (name === "phone_verifications")
        return {
          deleteMany: async (filter: { phone: string }) => {
            store.phoneVerifications = store.phoneVerifications.filter(
              (item) => item.phone !== filter.phone,
            );
          },
        };
      if (name === "pending_social_signups")
        return {
          deleteMany: async (filter: {
            "profile.provider": string;
            "profile.providerId": string;
          }) => {
            store.pendingSocialSignups = store.pendingSocialSignups.filter(
              (item) =>
                item.profile.provider !== filter["profile.provider"] ||
                item.profile.providerId !== filter["profile.providerId"],
            );
          },
        };
      return {
        findOne: async (filter: { userId: string }) =>
          structuredClone(
            store.jobs.find((item) => item.userId === filter.userId) ?? null,
          ),
        insertOne: async (
          item: AccountDeletionJob,
          insertOptions?: { session?: typeof session },
        ) => {
          if (insertOptions?.session !== session)
            throw new Error("job insertion must use the transaction session");
          if (options.failJobInsert) throw new Error("job insert failed");
          store.jobs.push(structuredClone(item));
        },
        findOneAndUpdate: async (
          filter: Record<string, unknown>,
          update: {
            $set: Partial<AccountDeletionJob>;
            $unset?: Record<string, "">;
          },
        ) => {
          const candidates = store.jobs.filter((item) =>
            matchesClaim(item, filter),
          );
          const selected = candidates.sort(
            (a, b) => a.nextAttemptAt.getTime() - b.nextAttemptAt.getTime(),
          )[0];
          if (!selected) return null;
          Object.assign(selected, update.$set);
          for (const field of Object.keys(update.$unset ?? {}))
            delete selected[field as keyof AccountDeletionJob];
          return structuredClone(selected);
        },
        find: (filter: { status: string }) => ({
          sort: () => ({
            toArray: async () =>
              store.jobs
                .filter((item) => item.status === filter.status)
                .map((item) => structuredClone(item)),
          }),
        }),
        replaceOne: async (
          filter: { id: string; status: "running"; leaseExpiresAt: Date },
          item: AccountDeletionJob,
        ) => {
          const index = store.jobs.findIndex(
            (job) =>
              job.id === filter.id &&
              job.status === filter.status &&
              job.leaseExpiresAt?.getTime() === filter.leaseExpiresAt.getTime(),
          );
          if (index < 0) return { matchedCount: 0 };
          store.jobs[index] = structuredClone(item);
          return { matchedCount: 1 };
        },
        deleteOne: async (filter: {
          id: string;
          status: "running";
          leaseExpiresAt: Date;
        }) => {
          const count = store.jobs.length;
          store.jobs = store.jobs.filter(
            (item) =>
              item.id !== filter.id ||
              item.status !== filter.status ||
              item.leaseExpiresAt?.getTime() !==
                filter.leaseExpiresAt.getTime(),
          );
          return { deletedCount: count - store.jobs.length };
        },
        updateOne: async (
          filter: { id: string; status: string },
          update: {
            $set: Partial<AccountDeletionJob>;
            $unset: Record<string, "">;
          },
        ) => {
          const item = store.jobs.find(
            (job) => job.id === filter.id && job.status === filter.status,
          );
          if (!item) return { matchedCount: 0 };
          Object.assign(item, update.$set);
          for (const field of Object.keys(update.$unset))
            delete item[field as keyof AccountDeletionJob];
          return { matchedCount: 1 };
        },
      };
    },
  };
  return {
    store,
    repository: new AccountDeletionJobsMongoRepository(
      async () => ({ startSession: () => session }) as never,
      async () => db as never,
    ),
  };
}

test("prepare atomically scrubs the active user, temporary auth records, and creates a safe job", async () => {
  const { repository, store } = createStore({
    user: {
      id: "user-1",
      accountStatus: "active",
      name: "실명",
      phone: "01012345678",
      email: "user@example.com",
      passwordHash: "hash",
      socialAccounts: [{ provider: "kakao", providerId: "social-1" }],
      handle: "real",
      avatarUrl: "avatar.jpg",
      lastLoginMethod: "kakao",
      lastLoginAt: NOW,
      lastSeenAt: NOW,
    },
  });

  const id = await repository.prepare("user-1", "withdrawn-1", NOW);

  assert.equal(typeof id, "string");
  assert.deepEqual(store.users, [
    { id: "user-1", accountStatus: "deleting", name: "탈퇴한 유저" },
  ]);
  assert.deepEqual(store.phoneVerifications, [{ phone: "other" }]);
  assert.deepEqual(store.pendingSocialSignups, [
    { profile: { provider: "naver", providerId: "other" } },
  ]);
  assert.deepEqual(store.jobs[0], {
    id,
    userId: "user-1",
    withdrawnId: "withdrawn-1",
    status: "pending",
    attempts: 0,
    cleanPasses: 0,
    createdAt: NOW,
    updatedAt: NOW,
    nextAttemptAt: NOW,
    deadlineAt: new Date("2026-08-22T00:00:00.000Z"),
  });
});

test("prepare rolls back the scrub when job insertion fails", async () => {
  const user = {
    id: "user-1",
    accountStatus: "active",
    name: "실명",
    phone: "01012345678",
  };
  const { repository, store } = createStore({ user, failJobInsert: true });

  await assert.rejects(repository.prepare("user-1", "withdrawn-1", NOW));

  assert.deepEqual(store.users, [user]);
  assert.equal(store.jobs.length, 0);
});

test("prepare rejects inactive users and existing jobs without mutation", async () => {
  const inactive = createStore({
    user: { id: "user-1", accountStatus: "suspended", name: "실명" },
  });
  await assert.rejects(
    inactive.repository.prepare("user-1", "withdrawn-1", NOW),
  );
  assert.equal(inactive.store.users[0].accountStatus, "suspended");

  const duplicate = createStore({
    user: { id: "user-1", accountStatus: "active", name: "실명" },
    jobs: [job()],
  });
  await assert.rejects(
    duplicate.repository.prepare("user-1", "withdrawn-1", NOW),
  );
  assert.equal(duplicate.store.users[0].accountStatus, "active");
});

test("claimById leases eligible jobs once and reclaims expired leases", async () => {
  const { repository } = createStore({ jobs: [job()] });
  const claimed = await repository.claimById("job-1", NOW);
  assert.equal(claimed?.status, "running");
  assert.deepEqual(
    claimed?.leaseExpiresAt,
    new Date("2026-08-21T00:10:00.000Z"),
  );
  assert.equal(await repository.claimById("job-1", NOW), null);

  const reclaimed = await repository.claimById(
    "job-1",
    new Date("2026-08-21T00:11:00.000Z"),
  );
  assert.equal(reclaimed?.status, "running");
  assert.deepEqual(
    reclaimed?.leaseExpiresAt,
    new Date("2026-08-21T00:21:00.000Z"),
  );
});

test("claimDue atomically leases at most the requested eligible jobs", async () => {
  const { repository } = createStore({
    jobs: [
      job({ id: "due-pending" }),
      job({ id: "due-verifying", status: "verifying" }),
      job({
        id: "expired",
        status: "running",
        leaseExpiresAt: new Date("2026-08-20T23:59:00.000Z"),
      }),
      job({
        id: "live",
        status: "running",
        leaseExpiresAt: new Date("2026-08-21T00:01:00.000Z"),
      }),
    ],
  });

  const claimed = await repository.claimDue(NOW, 2);

  assert.equal(claimed.length, 2);
  assert.equal(
    claimed.every((item) => item.status === "running"),
    true,
  );
  assert.equal((await repository.claimDue(NOW, 2)).length, 1);
});

test("listFailed omits identity fields and retry resets only failed jobs", async () => {
  const { repository, store } = createStore({
    jobs: [
      job({
        status: "failed",
        lastErrorCode: "verification_failed",
        leaseExpiresAt: NOW,
        deadlineAt: NOW,
      }),
    ],
  });

  assert.deepEqual(await repository.listFailed(), [
    {
      id: "job-1",
      status: "failed",
      attempts: 2,
      createdAt: new Date("2026-08-20T00:00:00.000Z"),
      updatedAt: new Date("2026-08-20T00:00:00.000Z"),
      deadlineAt: NOW,
      lastErrorCode: "verification_failed",
    },
  ]);
  assert.equal(await repository.retryFailed("job-1", NOW), true);
  assert.deepEqual(store.jobs[0], {
    ...job({
      status: "pending",
      attempts: 0,
      cleanPasses: 0,
      updatedAt: NOW,
      nextAttemptAt: NOW,
      deadlineAt: new Date("2026-08-22T00:00:00.000Z"),
    }),
  });
  assert.equal("leaseExpiresAt" in store.jobs[0], false);
  assert.equal("lastErrorCode" in store.jobs[0], false);
  assert.equal(await repository.retryFailed("job-1", NOW), false);
});

test("stale workers cannot save or complete a lease reacquired by another worker", async () => {
  const staleJob = job({
    status: "running",
    leaseExpiresAt: new Date("2026-08-20T23:59:00.000Z"),
  });
  const { repository, store } = createStore({ jobs: [staleJob] });

  const renewedJob = await repository.claimById("job-1", NOW);

  assert.ok(renewedJob);
  assert.equal(await repository.save(staleJob, job()), false);
  assert.equal(await repository.complete(staleJob), false);
  assert.deepEqual(store.jobs, [renewedJob]);
  assert.equal(await repository.save(job({ status: "running" }), job()), false);
});

test("saves a first clean pass with its claimed lease and completes a later claim", async () => {
  const { repository, store } = createStore({ jobs: [job()] });
  const claimed = await repository.claimById("job-1", NOW);
  assert.ok(claimed);
  const next = { ...claimed, status: "verifying" as const, cleanPasses: 1 };
  delete next.leaseExpiresAt;

  assert.equal(await repository.save(claimed, next), true);
  assert.equal(store.jobs[0].leaseExpiresAt, undefined);

  const laterClaim = await repository.claimById("job-1", NOW);
  assert.ok(laterClaim);
  assert.equal(await repository.complete(laterClaim), true);
  assert.equal(store.jobs.length, 0);
});
