import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { Db, MongoClient } from "mongodb";
import {
  cancelMyStaffRequest,
  decideStaffRequest,
  requestStaffJoin,
  StaffRequestError,
} from "./staffRequestRepository";

function matchesFilter(
  doc: Record<string, unknown>,
  filter: Record<string, unknown>,
): boolean {
  for (const [key, cond] of Object.entries(filter)) {
    if (doc[key] !== cond) return false;
  }
  return true;
}

function createFakeResources() {
  const data: Record<string, Array<Record<string, unknown>>> = {
    users: [
      {
        id: "owner-1",
        name: "사장1",
        role: "barista",
        accountStatus: "active",
      },
      {
        id: "barista-1",
        name: "바리스타1",
        role: "barista",
        accountStatus: "active",
      },
      {
        id: "enthusiast-1",
        name: "애호가1",
        role: "enthusiast",
        accountStatus: "active",
      },
    ],
    barista_showrooms: [
      { id: "store-1", userId: "owner-1", storeName: "블렌딩 로스터리" },
    ],
    coupon_store_staff: [],
    store_staff_requests: [],
    member_notifications: [],
  };

  const db = {
    data,
    collection(name: string) {
      const rows = (data[name] ??= []);
      return {
        findOne: async (filter: Record<string, unknown>) =>
          rows.find((d) => matchesFilter(d, filter)) ?? null,
        insertOne: async (doc: Record<string, unknown>) => {
          rows.push({ ...doc });
          return { insertedId: doc.id };
        },
        findOneAndUpdate: async (
          filter: Record<string, unknown>,
          update: { $set?: Record<string, unknown> },
        ) => {
          const idx = rows.findIndex((d) => matchesFilter(d, filter));
          if (idx === -1) return null;
          rows[idx] = { ...rows[idx], ...(update.$set ?? {}) };
          return { ...rows[idx] };
        },
        updateOne: async (
          filter: Record<string, unknown>,
          update: {
            $set?: Record<string, unknown>;
            $setOnInsert?: Record<string, unknown>;
          },
          options?: { upsert?: boolean },
        ) => {
          const idx = rows.findIndex((d) => matchesFilter(d, filter));
          if (idx === -1) {
            if (options?.upsert) {
              rows.push({
                ...filter,
                ...(update.$setOnInsert ?? {}),
                ...(update.$set ?? {}),
              });
              return { upsertedCount: 1 };
            }
            return { modifiedCount: 0 };
          }
          rows[idx] = { ...rows[idx], ...(update.$set ?? {}) };
          return { modifiedCount: 1 };
        },
      };
    },
  };

  const client = {
    startSession: () => ({
      withTransaction: async (fn: () => Promise<void>) => fn(),
      endSession: async () => undefined,
    }),
  };

  return {
    data,
    resources: {
      db: db as unknown as Db,
      client: client as unknown as MongoClient,
    },
  };
}

describe("staffRequestRepository", () => {
  let fake: ReturnType<typeof createFakeResources>;

  beforeEach(() => {
    fake = createFakeResources();
  });

  it("allows barista to request join, blocks non-barista/own-store/duplicate, and approves in transaction", async () => {
    await assert.rejects(
      () =>
        requestStaffJoin("enthusiast-1", "store-1", {
          db: fake.resources.db,
          skipPush: true,
        }),
      (err: unknown) => err instanceof StaffRequestError && err.status === 403,
    );

    await assert.rejects(
      () =>
        requestStaffJoin("owner-1", "store-1", {
          db: fake.resources.db,
          skipPush: true,
        }),
      (err: unknown) => err instanceof StaffRequestError && err.status === 400,
    );

    const req = await requestStaffJoin("barista-1", "store-1", {
      db: fake.resources.db,
      skipPush: true,
    });
    assert.equal(req.status, "PENDING");
    assert.equal(fake.data.member_notifications.length, 1);
    assert.equal(fake.data.member_notifications[0].ownerId, "owner-1");

    // Duplicate PENDING -> 409
    await assert.rejects(
      () =>
        requestStaffJoin("barista-1", "store-1", {
          db: fake.resources.db,
          skipPush: true,
        }),
      (err: unknown) => err instanceof StaffRequestError && err.status === 409,
    );

    // Non-owner decide -> 403
    await assert.rejects(
      () =>
        decideStaffRequest("barista-1", req.id, "approve", {
          resources: fake.resources,
          skipPush: true,
        }),
      (err: unknown) => err instanceof StaffRequestError && err.status === 403,
    );

    // Owner approves -> APPROVED + active staff row + notification to barista-1
    const approved = await decideStaffRequest("owner-1", req.id, "approve", {
      resources: fake.resources,
      skipPush: true,
    });
    assert.equal(approved.status, "APPROVED");
    assert.equal(fake.data.coupon_store_staff.length, 1);
    assert.equal(fake.data.coupon_store_staff[0].active, true);
    assert.equal(fake.data.coupon_store_staff[0].grantedBy, "owner-1");
    assert.equal(fake.data.member_notifications.length, 2);
    assert.equal(fake.data.member_notifications[1].ownerId, "barista-1");

    // Already active staff -> 409
    await assert.rejects(
      () =>
        requestStaffJoin("barista-1", "store-1", {
          db: fake.resources.db,
          skipPush: true,
        }),
      (err: unknown) => err instanceof StaffRequestError && err.status === 409,
    );
  });

  it("supports rejection and requester cancellation of pending request", async () => {
    const req1 = await requestStaffJoin("barista-1", "store-1", {
      db: fake.resources.db,
      skipPush: true,
    });
    const cancelled = await cancelMyStaffRequest(
      "barista-1",
      req1.id,
      fake.resources.db,
    );
    assert.equal(cancelled.status, "CANCELLED");

    const req2 = await requestStaffJoin("barista-1", "store-1", {
      db: fake.resources.db,
      skipPush: true,
    });
    const rejected = await decideStaffRequest("owner-1", req2.id, "reject", {
      resources: fake.resources,
      skipPush: true,
    });
    assert.equal(rejected.status, "REJECTED");
    assert.equal(fake.data.coupon_store_staff.length, 0);
  });
});
