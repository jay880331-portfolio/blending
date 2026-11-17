import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest, NextResponse } from "next/server";
import { createDeleteMemberAccountRoute } from "./memberAccountDeletionRoute";

function request(body: unknown) {
  return new NextRequest("https://blending.test/api/member/account", {
    method: "DELETE",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function createRoute(
  overrides: {
    getCurrentUser?: () => Promise<{ id: string } | null>;
    prepare?: (userId: string, withdrawnId: string) => Promise<string>;
    process?: (id: string) => Promise<unknown>;
    schedule?: (work: () => Promise<void>) => void;
    clearSessionCookie?: (response: NextResponse) => void;
  } = {},
) {
  return createDeleteMemberAccountRoute({
    getCurrentUser: async () => ({ id: "member-1" }),
    prepare: async () => "job-1",
    process: async () => "completed",
    schedule: (work) => {
      void work();
    },
    createWithdrawnId: () => "withdrawn-1",
    ensureIndexes: async () => {},
    clearSessionCookie: (response) => {
      response.cookies.set("blending_session", "", { maxAge: 0 });
    },
    ...overrides,
  });
}

test("rejects unauthenticated account deletion", async () => {
  const response = await createRoute({ getCurrentUser: async () => null })(
    request({ reason: "서비스를 이용하지 않아요." }),
  );

  assert.equal(response.status, 401);
});

test("rejects invalid deletion input before preparing a job", async () => {
  let prepared = false;
  const response = await createRoute({
    prepare: async () => ((prepared = true), "job-1"),
  })(request({ reason: "   " }));

  assert.equal(response.status, 400);
  assert.equal(prepared, false);
});

test("returns 500 and retains the session when preparation fails", async () => {
  const response = await createRoute({
    prepare: async () => {
      throw new Error("member-1 private/object.jpg");
    },
  })(request({ reason: "서비스를 이용하지 않아요." }));

  assert.equal(response.status, 500);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("accepts a prepared deletion and clears the session", async () => {
  const prepared: Array<[string, string]> = [];
  const response = await createRoute({
    prepare: async (userId, withdrawnId) => {
      prepared.push([userId, withdrawnId]);
      return "job-1";
    },
  })(request({ reason: "서비스를 이용하지 않아요." }));

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { success: true, pending: true });
  assert.deepEqual(prepared, [["member-1", "withdrawn-1"]]);
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
});

test("acceptance does not depend on scheduled worker result", async () => {
  for (const result of ["completed", "retried", "failed"]) {
    const response = await createRoute({ process: async () => result })(
      request({ reason: "서비스를 이용하지 않아요." }),
    );
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { success: true, pending: true });
  }
});

test("accepts immediately while a scheduled worker is unresolved", async () => {
  let scheduled: (() => Promise<void>) | undefined;
  let release!: () => void;
  const response = await Promise.race([
    createRoute({
      process: async () =>
        await new Promise<void>((resolve) => {
          release = resolve;
        }),
      schedule: (work) => {
        scheduled = work;
      },
    })(request({ reason: "서비스를 이용하지 않아요." })),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 50)),
  ]);

  assert.ok(response);
  assert.equal(response.status, 202);
  assert.ok(scheduled);
  const work = scheduled();
  release();
  await work;
});

test("does not log preparation identifiers and logs only fixed worker classification", async () => {
  const secret = "member-1/private/r2-secret.jpg";
  const calls: unknown[][] = [];
  let scheduled: (() => Promise<void>) | undefined;
  const originalError = console.error;
  console.error = (...args) => calls.push(args);

  try {
    const response = await createRoute({
      prepare: async () => {
        throw new Error(secret);
      },
    })(request({ reason: "서비스를 이용하지 않아요." }));
    assert.equal(response.status, 500);

    const accepted = await createRoute({
      process: async () => {
        throw new Error(secret);
      },
      schedule: (work) => {
        scheduled = work;
      },
    })(request({ reason: "서비스를 이용하지 않아요." }));
    assert.equal(accepted.status, 202);
    assert.ok(scheduled);
    await scheduled();
  } finally {
    console.error = originalError;
  }

  assert.equal(
    calls.flat().some((value) => String(value).includes(secret)),
    false,
  );
  assert.deepEqual(calls, [
    ["member_account_deletion_worker_failed", "worker_failed"],
  ]);
});
