import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClientSession, Db } from "mongodb";
import { authorizeStoreOwnerOrStaff } from "./storeAuthorization";

describe("authorizeStoreOwnerOrStaff", () => {
  it("runs queries sequentially without overlapping when a session is provided", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const callOrder: string[] = [];

    const fakeSession = { id: "fake-session" } as unknown as ClientSession;

    const fakeDb = {
      collection(name: string) {
        return {
          async findOne(
            query: Record<string, unknown>,
            options?: { session?: ClientSession },
          ) {
            assert.equal(options?.session, fakeSession);
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            assert.equal(
              inFlight,
              1,
              `concurrent query detected on ${name}: inFlight=${inFlight}`,
            );
            callOrder.push(`${name}:${String(query.id ?? query.userId)}`);

            await new Promise((resolve) => setTimeout(resolve, 5));
            inFlight -= 1;

            if (name === "barista_showrooms") {
              return {
                id: "store-1",
                userId: "owner-1",
                storeName: "성수 블렌딩",
                bioMessage: "소개",
                createdAt: "2026-11-17T00:00:00.000Z",
                updatedAt: "2026-11-17T00:00:00.000Z",
              };
            }
            if (name === "users") {
              return {
                id: query.id,
                role: "barista",
                accountStatus: "active",
              };
            }
            if (name === "coupon_store_staff") {
              return {
                _id: "staff-grant-1",
                storeId: "store-1",
                userId: "staff-1",
                grantedBy: "owner-1",
                active: true,
              };
            }
            return null;
          },
        };
      },
    } as unknown as Db;

    const result = await authorizeStoreOwnerOrStaff({
      userId: "staff-1",
      storeId: "store-1",
      db: fakeDb,
      session: fakeSession,
    });

    assert.equal(maxInFlight, 1);
    assert.deepEqual(callOrder, [
      "barista_showrooms:store-1",
      "users:staff-1",
      "users:owner-1",
      "coupon_store_staff:staff-1",
    ]);
    assert.equal(result.authorized, true);
    if (result.authorized) {
      assert.equal(result.isOwner, false);
      assert.equal(result.staff?._id, "staff-grant-1");
    }
  });
});
