import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AdminAuditLogDto } from "@blending/admin-contracts";
import { createAdminAuditMongoRepository } from "./adminAuditMongoRepository";

const auditLog: AdminAuditLogDto = {
  id: "audit-1",
  actorId: "admin-1",
  actorName: "관리자",
  action: "user.update",
  resourceType: "user",
  resourceId: "user-1",
  changedFields: ["name"],
  requestId: "request-1",
  ip: "127.0.0.1",
  userAgent: "test",
  createdAt: "2026-07-10T00:00:00.000Z",
};

type StoredAuditLog = AdminAuditLogDto & { _id: string };

function fakeCollection(document: StoredAuditLog) {
  const projections: unknown[] = [];
  const filters: unknown[] = [];

  function project(options?: { projection?: Record<string, number> }) {
    projections.push(options?.projection);
    if (options?.projection?._id !== 0) return document;
    const dto: Partial<StoredAuditLog> = { ...document };
    delete dto._id;
    return dto as AdminAuditLogDto;
  }

  return {
    projections,
    collection: {
      async insertOne() {},
      find(filter: unknown, options?: { projection?: Record<string, number> }) {
        filters.push(filter);
        return {
          sort() {
            return this;
          },
          skip() {
            return this;
          },
          limit() {
            return this;
          },
          async toArray() {
            return [project(options)];
          },
        };
      },
      async countDocuments(filter: unknown) {
        filters.push(filter);
        return 1;
      },
      async findOne(
        filter: unknown,
        options?: { projection?: Record<string, number> },
      ) {
        filters.push(filter);
        return project(options);
      },
    },
    filters,
  };
}

describe("adminAuditMongoRepository", () => {
  it("excludes Mongo _id from list results", async () => {
    const fake = fakeCollection({ _id: "mongo-1", ...auditLog });
    const repository = createAdminAuditMongoRepository(
      async () => fake.collection,
    );

    const page = await repository.list({});

    assert.deepEqual(fake.projections, [{ _id: 0 }]);
    assert.equal("_id" in page.items[0], false);
  });

  it("excludes Mongo _id from detail results", async () => {
    const fake = fakeCollection({ _id: "mongo-1", ...auditLog });
    const repository = createAdminAuditMongoRepository(
      async () => fake.collection,
    );

    const detail = await repository.findById("audit-1");

    assert.deepEqual(fake.projections, [{ _id: 0 }]);
    assert.equal(detail && "_id" in detail, false);
  });

  it("applies exact actor, action, resource, and date filters", async () => {
    const fake = fakeCollection({ _id: "mongo-1", ...auditLog });
    const repository = createAdminAuditMongoRepository(
      async () => fake.collection,
    );
    await repository.list({
      actorId: "admin-1",
      action: "user.update",
      resourceType: "user",
      resourceId: "user-1",
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-07-31T23:59:59.999Z",
    });
    assert.deepEqual(fake.filters[0], {
      actorId: "admin-1",
      action: "user.update",
      resourceType: "user",
      resourceId: "user-1",
      createdAt: {
        $gte: "2026-07-01T00:00:00.000Z",
        $lte: "2026-07-31T23:59:59.999Z",
      },
    });
  });
});
