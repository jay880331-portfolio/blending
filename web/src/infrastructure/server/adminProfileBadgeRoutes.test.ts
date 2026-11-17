import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  AdminProfileBadgeDto,
  AdminUserBadgeDto,
} from "@blending/admin-contracts";
import type { ClientSession } from "mongodb";
import { NextRequest } from "next/server";
import type { AdminAuditRepository } from "@/application/admin/adminUnitOfWork";
import {
  ProfileBadgeConflictError,
  type AdminProfileBadgeRepository,
} from "@/application/admin/profileBadgeUseCases";
import {
  assignAdminUserBadgeResponse,
  createAdminProfileBadgeResponse,
} from "./adminProfileBadgeRoutes";

const badge: AdminProfileBadgeDto = {
  id: "badge-1",
  name: "본부장",
  icon: "crown",
  imageUrl: "https://cdn.example.com/crown.png",
  sortOrder: 0,
  createdAt: "2026-08-27T00:00:00.000Z",
  updatedAt: "2026-08-27T00:00:00.000Z",
};

const assigned: AdminUserBadgeDto = {
  id: "badge-1",
  name: "본부장",
  icon: "crown",
  imageUrl: "https://cdn.example.com/crown.png",
  assignmentId: "assign-1",
  assignedAt: "2026-08-27T00:00:00.000Z",
};

const admin = { id: "admin-1", name: "관리자" } as Parameters<
  typeof createAdminProfileBadgeResponse
>[1];

const request = (url: string, method: string, body?: unknown) =>
  new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const dependencies = (
  repository: AdminProfileBadgeRepository,
  appended: unknown[] = [],
) => ({
  repository,
  unitOfWork: {
    run: async <T>(work: (session: ClientSession) => Promise<T>) =>
      work({} as ClientSession),
  },
  auditRepository: {
    append: async (input: Parameters<AdminAuditRepository["append"]>[0]) => {
      appended.push(input);
    },
  } as unknown as AdminAuditRepository,
});

describe("admin profile badge routes", () => {
  it("rejects an invalid catalog payload before mutation", async () => {
    let created = false;
    const repository = {
      create: async () => {
        created = true;
        return badge;
      },
    } as unknown as AdminProfileBadgeRepository;

    const response = await createAdminProfileBadgeResponse(
      request("http://localhost/api/admin/profile-badges", "POST", {
        badge: { ...badge, icon: "gold" },
      }),
      admin,
      dependencies(repository),
    );

    assert.equal(response.status, 400);
    assert.equal(created, false);
  });

  it("assigns a badge and writes an audited user update", async () => {
    const appended: unknown[] = [];
    const repository = {
      assign: async () => assigned,
    } as unknown as AdminProfileBadgeRepository;

    const response = await assignAdminUserBadgeResponse(
      request("http://localhost/api/admin/users/user-1/badges", "POST", {
        badgeId: "badge-1",
        reason: "공식 직함",
      }),
      admin,
      "user-1",
      dependencies(repository, appended),
    );

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), assigned);
    assert.equal(
      (appended[0] as { action: string; resourceType: string }).action,
      "user.update",
    );
    assert.equal(
      (appended[0] as { resourceType: string }).resourceType,
      "user.badge",
    );
  });

  it("returns conflict when the badge is already assigned", async () => {
    const repository = {
      assign: async () => {
        throw new ProfileBadgeConflictError("이미 부여된 뱃지입니다.");
      },
    } as unknown as AdminProfileBadgeRepository;

    const response = await assignAdminUserBadgeResponse(
      request("http://localhost/api/admin/users/user-1/badges", "POST", {
        badgeId: "badge-1",
        reason: "중복",
      }),
      admin,
      "user-1",
      dependencies(repository),
    );

    assert.equal(response.status, 409);
  });
});
