import assert from "node:assert/strict";
import test from "node:test";
import type { ClientSession } from "mongodb";
import { NextRequest } from "next/server";
import type { FailedAccountDeletionJobDto } from "@/application/member/accountDeletionJobs";
import type { AdminAuditRepository } from "@/application/admin/adminUnitOfWork";
import {
  getAdminAccountDeletionJobs,
  getAdminAccountDeletionJobsResponse,
  retryAdminAccountDeletionJob,
  retryAdminAccountDeletionJobResponse,
  type AdminAccountDeletionJobRouteDependencies,
} from "./adminAccountDeletionJobRoutes";

const job: FailedAccountDeletionJobDto = {
  id: "2be8d60c-1cff-4d79-bc7d-ef8bd748d34e",
  status: "failed",
  attempts: 3,
  createdAt: new Date("2026-08-20T00:00:00.000Z"),
  updatedAt: new Date("2026-08-21T00:00:00.000Z"),
  deadlineAt: new Date("2026-08-21T00:00:00.000Z"),
  lastErrorCode: "verification_failed",
};

const admin = { id: "admin-1", name: "관리자" };
const request = (method: string) =>
  new NextRequest("http://localhost:3001/api/admin/account-deletion-jobs", {
    method,
    headers: { "content-type": "application/json" },
  });

function dependencies(
  overrides: Partial<AdminAccountDeletionJobRouteDependencies> = {},
  appended: unknown[] = [],
) {
  const session = {} as ClientSession;
  return {
    session,
    value: {
      jobs: {
        listFailed: async () => [job],
        retryFailed: async (
          _id: string,
          _now: Date,
          receivedSession: ClientSession,
        ) => receivedSession === session,
      },
      unitOfWork: {
        run: async <T>(work: (activeSession: ClientSession) => Promise<T>) =>
          work(session),
      },
      auditRepository: {
        append: async (
          input: Parameters<AdminAuditRepository["append"]>[0],
          receivedSession: ClientSession,
        ) => appended.push({ input, receivedSession }),
      } as unknown as AdminAuditRepository,
      now: () => new Date("2026-08-21T01:00:00.000Z"),
      ensureIndexes: async () => {},
      ...overrides,
    } satisfies AdminAccountDeletionJobRouteDependencies,
  };
}

test("list handler rejects a request without an admin session", async () => {
  const response = await getAdminAccountDeletionJobs(request("GET"));

  assert.ok([401, 403].includes(response.status));
  assert.ok(
    ["UNAUTHENTICATED", "FORBIDDEN"].includes((await response.json()).code),
  );
});

test("retry handler rejects an unauthenticated mutation", async () => {
  const response = await retryAdminAccountDeletionJob(request("POST"), job.id);

  assert.ok([401, 403].includes(response.status));
  assert.ok(
    ["UNAUTHENTICATED", "FORBIDDEN"].includes((await response.json()).code),
  );
});

test("list response strips identity and operational fields from failed jobs", async () => {
  const response = await getAdminAccountDeletionJobsResponse({
    listFailed: async () =>
      [
        {
          ...job,
          userId: "user-1",
          withdrawnId: "withdrawn-1",
          legacyUploadUrl: "https://private.example.com/object",
          accessKey: "secret",
        },
      ] as unknown as FailedAccountDeletionJobDto[],
  });

  const body = await response.json();
  assert.deepEqual(body, [
    {
      id: job.id,
      status: "failed",
      attempts: 3,
      createdAt: "2026-08-20T00:00:00.000Z",
      updatedAt: "2026-08-21T00:00:00.000Z",
      deadlineAt: "2026-08-21T00:00:00.000Z",
      lastErrorCode: "verification_failed",
    },
  ]);
  assert.equal(
    JSON.stringify(body).match(/userId|withdrawnId|private|secret/),
    null,
  );
});

test("retry response hides missing or non-failed jobs", async () => {
  const { value } = dependencies({
    jobs: {
      listFailed: async () => [],
      retryFailed: async () => assert.fail("must not retry a non-failed job"),
    },
  });

  const response = await retryAdminAccountDeletionJobResponse(
    request("POST"),
    admin,
    job.id,
    value,
  );

  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, "NOT_FOUND");
});

test("retry response reports a concurrent state change without audit", async () => {
  const appended: unknown[] = [];
  const { value } = dependencies(
    { jobs: { listFailed: async () => [job], retryFailed: async () => false } },
    appended,
  );

  const response = await retryAdminAccountDeletionJobResponse(
    request("POST"),
    admin,
    job.id,
    value,
  );

  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "CONFLICT");
  assert.deepEqual(appended, []);
});

test("retry resets a failed job and audits it in the mutation session", async () => {
  const appended: unknown[] = [];
  const { session, value } = dependencies({}, appended);

  const response = await retryAdminAccountDeletionJobResponse(
    request("POST"),
    admin,
    job.id,
    value,
  );

  assert.deepEqual(await response.json(), { id: job.id, status: "pending" });
  assert.equal(appended.length, 1);
  assert.deepEqual(appended[0], {
    input: {
      ...(appended[0] as { input: object }).input,
      action: "account_deletion.retry",
      resourceType: "account_deletion_job",
      resourceId: job.id,
      changedFields: [
        "status",
        "attempts",
        "cleanPasses",
        "nextAttemptAt",
        "deadlineAt",
        "lastErrorCode",
      ],
    },
    receivedSession: session,
  });
  assert.equal(
    JSON.stringify(appended).match(/userId|withdrawnId|https?:|key/i),
    null,
  );
});
