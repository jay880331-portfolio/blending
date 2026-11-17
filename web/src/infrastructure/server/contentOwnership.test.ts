import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isContentOwner } from "./contentOwnership";

describe("isContentOwner", () => {
  it("never grants legacy ownerless content by display identity", () => {
    assert.equal(isContentOwner(undefined, "user-1"), false);
    assert.equal(isContentOwner("user-1", "user-1"), true);
    assert.equal(isContentOwner("user-2", "user-1"), false);
  });
});
