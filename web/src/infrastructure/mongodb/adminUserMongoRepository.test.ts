import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClientSession } from "mongodb";
import type { UserDocument } from "@/infrastructure/server/auth";
import {
  AdminUserMongoRepository,
  AdminUserNotFoundError,
  favoriteCountUpdate,
  favoriteStateFilter,
  toAdminUserDto,
  relatedFacet,
  toRelatedItem,
  toProfileSearchPatch,
  toUserFilter,
  toUserSort,
} from "./adminUserMongoRepository";

async function withMongoDb<T>(
  database: { collection(name: string): unknown },
  run: () => Promise<T>,
) {
  const mongoGlobal = globalThis as typeof globalThis & {
    __blendingMongoClientPromise?: Promise<unknown>;
  };
  const previousClientPromise = mongoGlobal.__blendingMongoClientPromise;
  mongoGlobal.__blendingMongoClientPromise = Promise.resolve({
    db: () => database,
  });
  try {
    return await run();
  } finally {
    if (previousClientPromise === undefined)
      delete mongoGlobal.__blendingMongoClientPromise;
    else mongoGlobal.__blendingMongoClientPromise = previousClientPromise;
  }
}

describe("AdminUserMongoRepository", () => {
  it("builds allowlisted list filters and stable sorting", () => {
    const filter = toUserFilter({
      q: "a.*",
      role: "barista",
      status: "active",
      loginMethod: "phone",
      from: "2026-01-01",
      to: "2026-01-31",
      page: 2,
      pageSize: 20,
      sort: "name",
      direction: "asc",
    });
    assert.equal(filter.role, "barista");
    assert.equal(filter.lastLoginMethod, "phone");
    assert.deepEqual(filter.$and?.at(-1), {
      $or: [{ accountStatus: "active" }, { accountStatus: { $exists: false } }],
    });
    assert.deepEqual(toUserSort({ sort: "name", direction: "asc" }), {
      name: 1,
      id: 1,
    });
  });

  it("projects only safe DTO fields and normalizes legacy status", () => {
    const user = {
      id: "user-1",
      name: "사용자",
      role: "enthusiast",
      workplaces: [],
      specialties: [],
      socials: { instagram: "", threads: "", website: "", recipeUrl: "" },
      socialAccounts: [{ provider: "kakao", providerId: "secret" }],
      passwordHash: "secret",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    } satisfies UserDocument;
    const dto = toAdminUserDto(user);
    assert.equal(dto.accountStatus, "active");
    assert.equal(dto.createdAt, "2026-01-01T00:00:00.000Z");
    assert.equal("passwordHash" in dto, false);
    assert.equal("socialAccounts" in dto, false);
  });

  it("maps deleting accounts to deleted in admin DTOs", () => {
    const user = {
      id: "user-1",
      name: "사용자",
      role: "enthusiast",
      accountStatus: "deleting",
      workplaces: [],
      specialties: [],
      socials: { instagram: "", threads: "", website: "", recipeUrl: "" },
      socialAccounts: [],
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    } satisfies UserDocument;
    assert.equal(toAdminUserDto(user).accountStatus, "deleted");
  });

  it("rejects direct status writes for deleting accounts", async () => {
    let filter: unknown;
    const database = {
      collection(name: string) {
        if (name === "users")
          return {
            async updateOne(nextFilter: unknown) {
              filter = nextFilter;
              return { matchedCount: 0 };
            },
          };
        return {};
      },
    };

    await withMongoDb(database, () =>
      assert.rejects(
        new AdminUserMongoRepository().updateStatus(
          "user-1",
          "deleted",
          "test",
          {} as ClientSession,
        ),
        AdminUserNotFoundError,
      ),
    );
    assert.deepEqual(filter, {
      id: "user-1",
      accountStatus: { $ne: "deleting" },
    });
  });

  it("rejects related soft-deletes before mutating a deleting account", async () => {
    let mutated = false;
    const database = {
      collection(name: string) {
        if (name === "users")
          return {
            async findOne() {
              return null;
            },
          };
        if (name === "member_activities")
          return {
            async updateOne() {
              mutated = true;
              return { matchedCount: 1 };
            },
          };
        return {};
      },
    };

    await withMongoDb(database, () =>
      assert.rejects(
        new AdminUserMongoRepository().mutateRelated(
          "user-1",
          "activity",
          "activity-1",
          { action: "soft-delete", reason: "test" },
          {} as ClientSession,
        ),
        AdminUserNotFoundError,
      ),
    );
    assert.equal(mutated, false);
  });

  it("paginates related data inside Mongo and maps chat-room state", () => {
    assert.deepEqual(relatedFacet(20, 20), {
      $facet: {
        items: [{ $skip: 20 }, { $limit: 20 }],
        count: [{ $count: "total" }],
      },
    });
    assert.deepEqual(
      toRelatedItem({
        id: "room-1",
        itemType: "chat-room",
        manageable: false,
        counterpartId: "user-2",
        blocked: true,
        muted: false,
      }),
      {
        id: "room-1",
        itemType: "chat-room",
        manageable: false,
        counterpartId: "user-2",
        blocked: true,
        muted: false,
      },
    );
  });

  it("changes a favorite count only for the expected soft-delete state", () => {
    assert.deepEqual(favoriteStateFilter("soft-delete"), {
      deletedAt: { $exists: false },
    });
    assert.deepEqual(favoriteStateFilter("restore"), {
      deletedAt: { $exists: true },
    });
    assert.deepEqual(favoriteCountUpdate("soft-delete"), [
      {
        $set: {
          favoriteCount: {
            $max: [0, { $subtract: [{ $ifNull: ["$favoriteCount", 0] }, 1] }],
          },
        },
      },
    ]);
    assert.deepEqual(favoriteCountUpdate("restore"), [
      {
        $set: {
          favoriteCount: {
            $add: [{ $ifNull: ["$favoriteCount", 0] }, 1],
          },
        },
      },
    ]);
  });

  it("includes an updated handle in the profile search body", () => {
    assert.deepEqual(
      toProfileSearchPatch({
        handle: "new-handle",
        workplace: "Blend Cafe",
        bio: "coffee",
      }),
      { body: "new-handle Blend Cafe coffee" },
    );
  });
});
