import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClientSession } from "mongodb";
import {
  changeUserRole,
  changeUserStatus,
  assertNoOwnerOverride,
  assertRelatedActionAllowed,
  getAdminUserDetail,
  listUserRelated,
  relatedMutationAudit,
} from "./userUseCases";
import type { UserLifecycleRecord } from "./userUseCases";

const session = {} as ClientSession;

function fakeRepository(
  user: UserLifecycleRecord = { id: "admin-2", role: "admin" },
  count = 1,
) {
  const calls: string[] = [];
  return {
    calls,
    repository: {
      async lockAdminRoleGuard(received: ClientSession) {
        assert.equal(received, session);
        calls.push("lock");
      },
      async countActiveAdmins(received: ClientSession) {
        assert.equal(received, session);
        calls.push("count");
        return count;
      },
      async findLifecycleById(_id: string, received: ClientSession) {
        assert.equal(received, session);
        calls.push("find");
        return user;
      },
      async updateStatus() {
        calls.push("status");
      },
      async updateRole() {
        calls.push("role");
      },
    },
  };
}

describe("admin user lifecycle", () => {
  it("rejects self demotion", async () => {
    const { repository } = fakeRepository({ id: "admin-1", role: "admin" });
    await assert.rejects(
      changeUserRole(
        { actorId: "admin-1", userId: "admin-1", role: "barista" },
        repository,
        session,
      ),
      /본인 권한/,
    );
  });

  it("serializes and rejects removal of the last active admin", async () => {
    const { repository, calls } = fakeRepository();
    await assert.rejects(
      changeUserStatus(
        {
          actorId: "admin-1",
          userId: "admin-2",
          status: "suspended",
          reason: "test",
        },
        repository,
        session,
      ),
      /마지막 관리자/,
    );
    assert.deepEqual(calls, ["lock", "find", "count"]);
  });

  it("allows changing an already inactive admin without false last-admin blocking", async () => {
    const { repository, calls } = fakeRepository({
      id: "admin-2",
      role: "admin",
      accountStatus: "suspended",
    });
    await changeUserRole(
      { actorId: "admin-1", userId: "admin-2", role: "barista" },
      repository,
      session,
    );
    assert.deepEqual(calls, ["lock", "find", "role"]);
  });

  it("returns false and does not write for role and status no-ops", async () => {
    const role = fakeRepository({ id: "user-1", role: "barista" });
    assert.equal(
      await changeUserRole(
        { actorId: "admin-1", userId: "user-1", role: "barista" },
        role.repository,
        session,
      ),
      false,
    );
    assert.deepEqual(role.calls, ["lock", "find"]);

    const status = fakeRepository({
      id: "user-1",
      role: "barista",
      accountStatus: "suspended",
    });
    assert.equal(
      await changeUserStatus(
        {
          actorId: "admin-1",
          userId: "user-1",
          status: "suspended",
          reason: "no-op",
        },
        status.repository,
        session,
      ),
      false,
    );
    assert.deepEqual(status.calls, ["lock", "find"]);
  });

  it("rejects role and status changes while deletion is in progress", async () => {
    const role = fakeRepository({
      id: "user-1",
      role: "barista",
      accountStatus: "deleting",
    });
    await assert.rejects(
      changeUserRole(
        { actorId: "admin-1", userId: "user-1", role: "enthusiast" },
        role.repository,
        session,
      ),
      /탈퇴 처리 중/,
    );
    assert.deepEqual(role.calls, ["lock", "find"]);

    const status = fakeRepository({
      id: "user-1",
      role: "barista",
      accountStatus: "deleting",
    });
    await assert.rejects(
      changeUserStatus(
        {
          actorId: "admin-1",
          userId: "user-1",
          status: "deleted",
          reason: "test",
        },
        status.repository,
        session,
      ),
      /탈퇴 처리 중/,
    );
    assert.deepEqual(status.calls, ["lock", "find"]);
  });
});

describe("admin user related data", () => {
  it("rejects ownerId overrides", () => {
    assert.throws(
      () => assertNoOwnerOverride({ ownerId: "other-user", title: "경력" }),
      /ownerId/,
    );
    assert.doesNotThrow(() => assertNoOwnerOverride({ title: "경력" }));
  });

  it("never returns password, provider id, or push token values", async () => {
    const detail = await getAdminUserDetail("user-1", {
      async findDetail() {
        return {
          id: "user-1",
          name: "사용자",
          passwordHash: "hash",
          oauth: { providerId: "provider-1" },
          devices: [{ expoPushToken: "push-1" }],
        };
      },
    });

    assert(detail);
    assert.equal("passwordHash" in detail, false);
    assert.equal(JSON.stringify(detail).includes("providerId"), false);
    assert.equal(JSON.stringify(detail).includes("expoPushToken"), false);
  });

  it("audits message history access", async () => {
    const entries: string[] = [];
    const result = await listUserRelated(
      "admin-1",
      "user-1",
      { kind: "messages", page: 1, pageSize: 20 },
      {
        async listRelated() {
          return {
            items: [],
            pagination: {
              page: 1,
              pageSize: 20,
              total: 0,
              totalPages: 0,
            },
          };
        },
      },
      async (entry) => {
        entries.push(entry.action);
        return "audit-1";
      },
    );

    assert.equal(entries.at(-1), "sensitive.read");
    assert.equal(result.auditId, "audit-1");
  });

  it("allows only the related-data action assigned to each kind", () => {
    assert.doesNotThrow(() =>
      assertRelatedActionAllowed("activity", "soft-delete"),
    );
    assert.doesNotThrow(() =>
      assertRelatedActionAllowed("notifications", "soft-delete"),
    );
    assert.doesNotThrow(() => assertRelatedActionAllowed("auth", "revoke"));
    assert.throws(
      () => assertRelatedActionAllowed("auth", "soft-delete"),
      /지원하지/,
    );
    assert.throws(
      () => assertRelatedActionAllowed("notifications", "revoke"),
      /지원하지/,
    );
  });

  it("describes permanent notification cleanup and token revoke truthfully", () => {
    assert.deepEqual(relatedMutationAudit("notifications", "soft-delete"), {
      action: "notification.delete",
      changedFields: [],
    });
    assert.deepEqual(relatedMutationAudit("auth", "revoke"), {
      action: "auth.token_revoke",
      changedFields: ["disabled", "revokedAt"],
    });
  });
});
