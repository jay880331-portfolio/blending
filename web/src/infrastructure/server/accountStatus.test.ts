import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UserDocument } from "./auth";
import { activeAccountFilter, isActiveAccount } from "./accountStatus";

describe("accountStatus", () => {
  it("treats legacy users as active and blocks inactive users", () => {
    assert.equal(isActiveAccount({}), true);
    assert.equal(isActiveAccount({ accountStatus: "active" }), true);
    assert.equal(isActiveAccount({ accountStatus: "suspended" }), false);
    assert.equal(isActiveAccount({ accountStatus: "deleted" }), false);
    const deletingUser: Pick<UserDocument, "accountStatus"> = {
      accountStatus: "deleting",
    };
    assert.equal(isActiveAccount(deletingUser), false);
    assert.deepEqual(activeAccountFilter(), {
      $or: [{ accountStatus: "active" }, { accountStatus: { $exists: false } }],
    });
  });
});
