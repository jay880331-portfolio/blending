import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { Db } from "mongodb";
import {
  BrewGuideError,
  createBrewGuide,
  deleteBrewGuide,
  getBrewGuideById,
  listAuthorizedStoresForBrewGuide,
  listStoreBrewGuides,
  updateBrewGuide,
} from "./brewGuideRepository";

function matchesFilter(
  doc: Record<string, unknown>,
  filter: Record<string, unknown>,
): boolean {
  for (const [key, cond] of Object.entries(filter)) {
    if (key === "$or" && Array.isArray(cond)) {
      if (
        !cond.some((sub) => matchesFilter(doc, sub as Record<string, unknown>))
      ) {
        return false;
      }
      continue;
    }
    if (
      cond &&
      typeof cond === "object" &&
      !Array.isArray(cond) &&
      "$in" in cond &&
      Array.isArray((cond as { $in: unknown[] }).$in)
    ) {
      if (!(cond as { $in: unknown[] }).$in.includes(doc[key])) {
        return false;
      }
      continue;
    }
    if (doc[key] !== cond) return false;
  }
  return true;
}

function createFakeDb() {
  const storeData: Record<string, Array<Record<string, unknown>>> = {
    users: [
      {
        id: "owner-1",
        name: "사장1",
        handle: "owner1",
        role: "barista",
        accountStatus: "active",
      },
      {
        id: "owner-2",
        name: "사장2",
        handle: "owner2",
        role: "barista",
        accountStatus: "active",
      },
      {
        id: "staff-active",
        name: "활성직원",
        handle: "staff1",
        role: "barista",
        accountStatus: "active",
      },
      {
        id: "staff-revoked",
        name: "해제직원",
        handle: "staff2",
        role: "barista",
        accountStatus: "active",
      },
      {
        id: "stranger-1",
        name: "타인",
        handle: "stranger",
        role: "barista",
        accountStatus: "active",
      },
    ],
    barista_showrooms: [
      { id: "store-1", userId: "owner-1", storeName: "매장1" },
      { id: "store-2", userId: "owner-2", storeName: "매장2" },
    ],
    coupon_store_staff: [
      {
        id: "cs-1",
        storeId: "store-1",
        userId: "staff-active",
        grantedBy: "owner-1",
        active: true,
      },
      {
        id: "cs-2",
        storeId: "store-1",
        userId: "staff-revoked",
        grantedBy: "owner-1",
        active: false,
      },
    ],
    showroom_beans: [
      { id: "bean-1", storeId: "store-1", active: true },
      { id: "bean-2", storeId: "store-2", active: true },
    ],
    brew_guides: [],
  };

  const db = {
    storeData,
    collection(name: string) {
      const rows = (storeData[name] ??= []);
      return {
        findOne: async (filter: Record<string, unknown>) =>
          rows.find((d) => matchesFilter(d, filter)) ?? null,
        find: (filter: Record<string, unknown>) => {
          let list = rows.filter((d) => matchesFilter(d, filter));
          const cursor = {
            sort: () => cursor,
            limit: (n: number) => {
              list = list.slice(0, n);
              return cursor;
            },
            toArray: async () => list.map((d) => ({ ...d })),
          };
          return cursor;
        },
        insertOne: async (doc: Record<string, unknown>) => {
          rows.push({ ...doc });
          return { insertedId: doc.id };
        },
        findOneAndUpdate: async (
          filter: Record<string, unknown>,
          update: {
            $set?: Record<string, unknown>;
            $unset?: Record<string, unknown>;
          },
        ) => {
          const idx = rows.findIndex((d) => matchesFilter(d, filter));
          if (idx === -1) return null;
          const next = { ...rows[idx], ...(update.$set ?? {}) };
          if (update.$unset) {
            for (const key of Object.keys(update.$unset)) {
              delete next[key];
            }
          }
          rows[idx] = next;
          return { ...next };
        },
        deleteOne: async (filter: Record<string, unknown>) => {
          const idx = rows.findIndex((d) => matchesFilter(d, filter));
          if (idx === -1) return { deletedCount: 0 };
          rows.splice(idx, 1);
          return { deletedCount: 1 };
        },
      };
    },
  };
  return db;
}

describe("brewGuideRepository", () => {
  let fake: ReturnType<typeof createFakeDb>;
  let db: Db;

  beforeEach(() => {
    fake = createFakeDb();
    db = fake as unknown as Db;
  });

  const validFilter = {
    doseG: 18,
    grind: "중간-가늘게",
    waterTempC: 93,
    yieldG: 280,
    timeSec: 150,
  };
  const validEspresso = {
    doseG: 19,
    basketG: 20,
    waterTempC: 92,
    yieldG: 38,
    timeSec: 28,
  };

  it("allows owner and active staff to create, and omits authorId from public responses", async () => {
    const byOwner = await createBrewGuide(
      "owner-1",
      "store-1",
      {
        title: "에티오피아",
        beanId: "bean-1",
        filter: validFilter,
      },
      db,
    );
    assert.equal(byOwner.storeName, "매장1");
    assert.equal(byOwner.authorName, "사장1");
    assert.equal(byOwner.authorHandle, "owner1");
    assert.equal("authorId" in byOwner, false);

    const byStaff = await createBrewGuide(
      "staff-active",
      "store-1",
      {
        title: "콜롬비아",
        beanId: null,
        espresso: validEspresso,
      },
      db,
    );
    assert.equal(byStaff.authorName, "활성직원");
    assert.equal("authorId" in byStaff, false);

    const fetched = await getBrewGuideById(byOwner.id, db);
    assert.ok(fetched);
    assert.equal("authorId" in fetched, false);

    const list = await listStoreBrewGuides("store-1", db);
    assert.equal(list.length, 2);
    assert.equal("authorId" in list[0], false);
  });

  it("rejects stranger and revoked staff with 403, and cross-store beanId with 404", async () => {
    await assert.rejects(
      () =>
        createBrewGuide(
          "stranger-1",
          "store-1",
          { title: "원두", beanId: null, filter: validFilter },
          db,
        ),
      (err: unknown) => err instanceof BrewGuideError && err.status === 403,
    );

    await assert.rejects(
      () =>
        createBrewGuide(
          "staff-revoked",
          "store-1",
          { title: "원두", beanId: null, filter: validFilter },
          db,
        ),
      (err: unknown) => err instanceof BrewGuideError && err.status === 403,
    );

    await assert.rejects(
      () =>
        createBrewGuide(
          "owner-1",
          "store-1",
          { title: "원두", beanId: "bean-2", filter: validFilter },
          db,
        ),
      (err: unknown) => err instanceof BrewGuideError && err.status === 404,
    );
  });

  it("enforces update/delete permissions and unsets removed recipe side", async () => {
    const created = await createBrewGuide(
      "owner-1",
      "store-1",
      {
        title: "블렌드",
        beanId: "bean-1",
        filter: validFilter,
        espresso: validEspresso,
      },
      db,
    );

    await assert.rejects(
      () =>
        updateBrewGuide(
          "staff-revoked",
          created.id,
          { title: "변경", beanId: null, filter: validFilter },
          db,
        ),
      (err: unknown) => err instanceof BrewGuideError && err.status === 403,
    );

    // Active staff updates guide removing espresso -> $unset espresso
    const updated = await updateBrewGuide(
      "staff-active",
      created.id,
      { title: "블렌드 필터", beanId: "bean-1", filter: validFilter },
      db,
    );
    assert.equal(updated.espresso, undefined);
    assert.equal("espresso" in fake.storeData.brew_guides[0], false);

    // Stranger delete -> 403
    await assert.rejects(
      () => deleteBrewGuide("stranger-1", created.id, db),
      (err: unknown) => err instanceof BrewGuideError && err.status === 403,
    );

    // Owner delete -> succeeds
    await deleteBrewGuide("owner-1", created.id, db);
    assert.equal(await getBrewGuideById(created.id, db), null);
  });

  it("lists owned and active staff stores in eligible list and excludes revoked staff", async () => {
    const ownerStores = await listAuthorizedStoresForBrewGuide("owner-1", db);
    assert.deepEqual(ownerStores, [{ id: "store-1", storeName: "매장1" }]);

    const staffStores = await listAuthorizedStoresForBrewGuide(
      "staff-active",
      db,
    );
    assert.deepEqual(staffStores, [{ id: "store-1", storeName: "매장1" }]);

    const revokedStores = await listAuthorizedStoresForBrewGuide(
      "staff-revoked",
      db,
    );
    assert.deepEqual(revokedStores, []);
  });
});
