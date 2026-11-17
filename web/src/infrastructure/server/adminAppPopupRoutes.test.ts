import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AdminAppPopupDto } from "@blending/admin-contracts";
import type { ClientSession } from "mongodb";
import { NextRequest } from "next/server";
import type { AdminAppPopupRepository } from "@/application/admin/appPopupUseCases";
import type { AdminAuditRepository } from "@/application/admin/adminUnitOfWork";
import {
  createAdminAppPopupResponse,
  deleteAdminAppPopupResponse,
  getAdminAppPopupsResponse,
  toggleAdminAppPopupResponse,
  updateAdminAppPopupResponse,
} from "./adminAppPopupRoutes";

const popup: AdminAppPopupDto = {
  id: "popup-1",
  adminTitle: "여름 프로모션",
  imageUrl: "https://cdn.example.com/popup.webp",
  imageAlt: "여름 프로모션 안내",
  href: "/partner/promotions",
  placements: ["home"],
  priority: 1,
  startsAt: "2026-08-20T00:00:00.000Z",
  endsAt: "2026-08-21T00:00:00.000Z",
  enabled: true,
  createdAt: "2026-08-19T00:00:00.000Z",
  updatedAt: "2026-08-19T00:00:00.000Z",
};

const admin = { id: "admin-1", name: "관리자" } as Parameters<
  typeof createAdminAppPopupResponse
>[1];

const request = (url: string, method: string, body?: unknown) =>
  new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const dependencies = (
  repository: AdminAppPopupRepository,
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

describe("admin app popup routes", () => {
  it("lists popups through the injected repository", async () => {
    const repository = { list: async () => [popup] } as AdminAppPopupRepository;

    const response = await getAdminAppPopupsResponse(repository);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [popup]);
  });

  it("rejects an invalid create payload before mutation", async () => {
    let created = false;
    const repository = {
      create: async () => {
        created = true;
        return popup;
      },
    } as unknown as AdminAppPopupRepository;

    const response = await createAdminAppPopupResponse(
      request("http://localhost/api/admin/popups", "POST", {
        popup: { ...popup, placements: [] },
      }),
      admin,
      dependencies(repository),
    );

    assert.equal(response.status, 400);
    assert.equal(created, false);
  });

  it("creates a popup and records its audit log", async () => {
    const appended: unknown[] = [];
    const repository = {
      create: async () => popup,
    } as unknown as AdminAppPopupRepository;

    const response = await createAdminAppPopupResponse(
      request("http://localhost/api/admin/popups", "POST", { popup }),
      admin,
      dependencies(repository, appended),
    );

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), popup);
    assert.equal(appended.length, 1);
    assert.deepEqual(appended[0], {
      ...(appended[0] as object),
      action: "popup.create",
      resourceType: "app_popup",
      resourceId: popup.id,
      changedFields: [
        "adminTitle",
        "imageUrl",
        "imageAlt",
        "href",
        "placements",
        "priority",
        "startsAt",
        "endsAt",
        "enabled",
      ],
    });
  });

  it("returns not found when updating a missing popup", async () => {
    const repository = {
      update: async () => null,
    } as unknown as AdminAppPopupRepository;

    const response = await updateAdminAppPopupResponse(
      request("http://localhost/api/admin/popups/missing", "PUT", { popup }),
      admin,
      "missing",
      dependencies(repository),
    );

    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, "NOT_FOUND");
  });

  it("updates a popup and records the update action", async () => {
    const appended: unknown[] = [];
    const updated = { ...popup, priority: 2 };
    const repository = {
      update: async () => updated,
    } as unknown as AdminAppPopupRepository;

    const response = await updateAdminAppPopupResponse(
      request("http://localhost/api/admin/popups/popup-1", "PUT", {
        popup: updated,
      }),
      admin,
      popup.id,
      dependencies(repository, appended),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), updated);
    assert.equal(appended.length, 1);
    assert.deepEqual(appended[0], {
      ...(appended[0] as object),
      action: "popup.update",
      resourceType: "app_popup",
      resourceId: popup.id,
      changedFields: [
        "adminTitle",
        "imageUrl",
        "imageAlt",
        "href",
        "placements",
        "priority",
        "startsAt",
        "endsAt",
        "enabled",
      ],
    });
  });

  it("toggles a popup and records the toggle action", async () => {
    const appended: unknown[] = [];
    const repository = {
      setEnabled: async () => ({ ...popup, enabled: false }),
    } as unknown as AdminAppPopupRepository;

    const response = await toggleAdminAppPopupResponse(
      request("http://localhost/api/admin/popups/popup-1/enabled", "PATCH", {
        enabled: false,
      }),
      admin,
      popup.id,
      dependencies(repository, appended),
    );

    assert.equal(response.status, 200);
    assert.equal((await response.json()).enabled, false);
    assert.equal(appended.length, 1);
    assert.deepEqual(appended[0], {
      ...(appended[0] as object),
      action: "popup.toggle",
      resourceType: "app_popup",
      resourceId: popup.id,
      changedFields: ["enabled"],
    });
  });

  it("deletes a popup and records the delete action", async () => {
    const appended: unknown[] = [];
    const repository = {
      delete: async () => popup,
    } as unknown as AdminAppPopupRepository;

    const response = await deleteAdminAppPopupResponse(
      request("http://localhost/api/admin/popups/popup-1", "DELETE"),
      admin,
      popup.id,
      dependencies(repository, appended),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), popup);
    assert.equal(appended.length, 1);
    assert.deepEqual(appended[0], {
      ...(appended[0] as object),
      action: "popup.delete",
      resourceType: "app_popup",
      resourceId: popup.id,
      changedFields: [],
    });
  });

  it("does not audit when deleting a missing popup", async () => {
    const appended: unknown[] = [];
    const repository = {
      delete: async () => null,
    } as unknown as AdminAppPopupRepository;

    const response = await deleteAdminAppPopupResponse(
      request("http://localhost/api/admin/popups/missing", "DELETE"),
      admin,
      "missing",
      dependencies(repository, appended),
    );

    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, "NOT_FOUND");
    assert.equal(appended.length, 0);
  });
});
