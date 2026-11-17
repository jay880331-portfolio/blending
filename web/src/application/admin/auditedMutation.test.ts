import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NewAdminAuditLog } from "@blending/admin-contracts";
import type { ClientSession } from "mongodb";
import type { AdminAuditRepository, AdminUnitOfWork } from "./adminUnitOfWork";
import { assertSafeAuditFields, runAuditedMutation } from "./auditedMutation";

const auditInput: NewAdminAuditLog = {
  actorId: "admin-1",
  actorName: "관리자",
  action: "user.update",
  resourceType: "user",
  resourceId: "user-1",
  changedFields: ["name"],
  requestId: "request-1",
  ip: "127.0.0.1",
  userAgent: "test",
};

function fakeUnitOfWork(state: string[]): AdminUnitOfWork {
  return {
    async run(work) {
      const snapshot = [...state];
      try {
        return await work({} as ClientSession);
      } catch (error) {
        state.splice(0, state.length, ...snapshot);
        throw error;
      }
    },
  };
}

const failingAuditRepository: AdminAuditRepository = {
  async append() {
    throw new Error("audit append failed");
  },
  async list() {
    throw new Error("not used");
  },
  async findById() {
    throw new Error("not used");
  },
};

describe("runAuditedMutation", () => {
  it("rolls back the mutation when audit append fails", async () => {
    const state: string[] = [];

    await assert.rejects(() =>
      runAuditedMutation(
        fakeUnitOfWork(state),
        failingAuditRepository,
        auditInput,
        async () => {
          state.push("changed");
          return "ok";
        },
      ),
    );

    assert.deepEqual(state, []);
  });

  it("does not append an audit entry for a no-op result", async () => {
    let appended = 0;
    const repository = {
      ...failingAuditRepository,
      async append() {
        appended += 1;
      },
    };
    const result = await runAuditedMutation(
      fakeUnitOfWork([]),
      repository,
      auditInput,
      async () => false,
      Boolean,
    );
    assert.equal(result, false);
    assert.equal(appended, 0);
  });

  it("derives truthful changed fields from the mutation result", async () => {
    let appended: NewAdminAuditLog | undefined;
    const repository = {
      ...failingAuditRepository,
      async append(input: NewAdminAuditLog) {
        appended = input;
      },
    };
    await runAuditedMutation(
      fakeUnitOfWork([]),
      repository,
      (result: { ownerClaimed: boolean }) => ({
        ...auditInput,
        changedFields: ["title", ...(result.ownerClaimed ? ["ownerId"] : [])],
      }),
      async () => ({ ownerClaimed: true }),
    );
    assert.deepEqual(appended?.changedFields, ["title", "ownerId"]);
  });
});

describe("assertSafeAuditFields", () => {
  it("rejects sensitive audit field names", () => {
    for (const field of [
      "password",
      "passwordHash",
      "credential",
      "credentials",
      "secret",
      "clientSecret",
      "token",
      "accessToken",
      "refreshToken",
      "pushToken",
      "expoPushToken",
      "csrf",
      "csrfToken",
      "sessionId",
      "sessionToken",
      "sessionCookie",
      "oauthProviderId",
      "providerId",
      "pushRegistrationId",
      "socialAccounts.providerId",
      "socialAccounts[0].providerId",
      "socialAccounts[].providerId",
    ]) {
      assert.throws(() => assertSafeAuditFields([field]), /민감한 필드/);
    }
  });

  it("allows non-sensitive audit field names", () => {
    assert.doesNotThrow(() =>
      assertSafeAuditFields([
        "pushNotificationsEnabled",
        "sessionTimeoutMinutes",
        "oauthLoginEnabled",
        "tokenCount",
        "actorId",
        "resourceId",
        "changedFields",
      ]),
    );
  });
});
