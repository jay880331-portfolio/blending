import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import type { AccountDeletionJob } from "@/application/member/accountDeletionJobs";
import {
  createAccountDeletionCronRoute,
  type AccountDeletionCronDependencies,
} from "./accountDeletionCronRoute";

const now = new Date("2026-08-21T12:00:00.000Z");

function job(id: string): AccountDeletionJob {
  return {
    id,
    userId: `user-${id}`,
    withdrawnId: `withdrawn-${id}`,
    status: "running",
    attempts: 0,
    cleanPasses: 0,
    createdAt: now,
    updatedAt: now,
    nextAttemptAt: now,
    deadlineAt: new Date("2026-08-22T12:00:00.000Z"),
    leaseExpiresAt: new Date("2026-08-21T12:10:00.000Z"),
  };
}

function createRoute(overrides: Partial<AccountDeletionCronDependencies> = {}) {
  const dependencies: AccountDeletionCronDependencies = {
    claimDue: async () => [],
    process: async () => "retried",
    now: () => now,
    ensureIndexes: async () => {},
    ...overrides,
  };
  return createAccountDeletionCronRoute(dependencies);
}

function request(authorization?: string) {
  return new NextRequest(
    "https://example.com/api/internal/account-deletions/process",
    {
      headers: authorization ? { authorization } : undefined,
    },
  );
}

test("rejects missing or wrong bearer credentials before claiming jobs", async () => {
  process.env.CRON_SECRET = "secret";
  let claims = 0;
  const route = createRoute({
    claimDue: async () => (++claims, []),
  });

  for (const authorization of [undefined, "Bearer wrong"]) {
    const response = await route(request(authorization));
    assert.equal(response.status, 401);
  }
  assert.equal(claims, 0);
});

test("claims one due job at a time with the exact bearer credential", async () => {
  process.env.CRON_SECRET = "secret";
  let claimedAt: Date | undefined;
  let claimLimit: number | undefined;
  const route = createRoute({
    claimDue: async (claimedNow, limit) => {
      claimedAt = claimedNow;
      claimLimit = limit;
      return [];
    },
  });

  const response = await route(request("Bearer secret"));

  assert.equal(response.status, 200);
  assert.equal(claimedAt, now);
  assert.equal(claimLimit, 1);
});

test("processes each claimed job once and reports only aggregate counts", async () => {
  process.env.CRON_SECRET = "secret";
  const processed: string[] = [];
  const route = createRoute({
    claimDue: async () => {
      const id = ["one", "two", "three"][processed.length];
      return id ? [job(id)] : [];
    },
    process: async (claimedJob) => {
      processed.push(claimedJob.id);
      return claimedJob.id === "one"
        ? "completed"
        : claimedJob.id === "two"
          ? "failed"
          : "retried";
    },
  });

  const response = await route(request("Bearer secret"));
  const body = await response.json();
  const serialized = JSON.stringify(body);

  assert.deepEqual(processed, ["one", "two", "three"]);
  assert.deepEqual(body, { claimed: 3, completed: 1, retried: 1, failed: 1 });
  assert.equal(serialized.includes("one"), false);
  assert.equal(serialized.includes("user-"), false);
});

test("continues processing after a worker failure", async () => {
  process.env.CRON_SECRET = "secret";
  const processed: string[] = [];
  const route = createRoute({
    claimDue: async () =>
      processed.length < 2 ? [job(processed.length ? "two" : "one")] : [],
    process: async (claimedJob) => {
      processed.push(claimedJob.id);
      if (claimedJob.id === "one") throw new Error("worker failed");
      return "completed";
    },
  });

  const response = await route(request("Bearer secret"));

  assert.deepEqual(processed, ["one", "two"]);
  assert.deepEqual(await response.json(), {
    claimed: 2,
    completed: 1,
    retried: 1,
    failed: 0,
  });
});

test("does not claim a later job after the fifty second budget", async () => {
  process.env.CRON_SECRET = "secret";
  const times = [0, 0, 0, 50_000];
  let calls = 0;
  const route = createRoute({
    now: () => new Date(now.getTime() + (times.shift() ?? 50_000)),
    claimDue: async () =>
      ++calls === 1 ? [job("one")] : assert.fail("must not pre-lease"),
    process: async () => "retried",
  });
  const response = await route(request("Bearer secret"));
  assert.deepEqual(await response.json(), {
    claimed: 1,
    completed: 0,
    retried: 1,
    failed: 0,
  });
  assert.equal(calls, 1);
});

test("claims when index readiness leaves one millisecond in the budget", async () => {
  process.env.CRON_SECRET = "secret";
  let elapsed = 0;
  let claims = 0;
  const route = createRoute({
    now: () => new Date(now.getTime() + elapsed),
    ensureIndexes: async () => {
      elapsed = 49_999;
    },
    claimDue: async () => (++claims === 1 ? [job("one")] : []),
  });

  const response = await route(request("Bearer secret"));

  assert.equal(claims, 2);
  assert.deepEqual(await response.json(), {
    claimed: 1,
    completed: 0,
    retried: 1,
    failed: 0,
  });
});

test("does not claim when index readiness consumes the full budget", async () => {
  process.env.CRON_SECRET = "secret";
  let elapsed = 0;
  let claims = 0;
  const route = createRoute({
    now: () => new Date(now.getTime() + elapsed),
    ensureIndexes: async () => {
      elapsed = 50_000;
    },
    claimDue: async () => (++claims, []),
  });

  const response = await route(request("Bearer secret"));

  assert.equal(claims, 0);
  assert.deepEqual(await response.json(), {
    claimed: 0,
    completed: 0,
    retried: 0,
    failed: 0,
  });
});
