import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAdminPageSize } from "./common";

describe(isAdminPageSize.name, () => {
  it("accepts only supported page sizes", () => {
    assert.equal(isAdminPageSize(20), true);
    assert.equal(isAdminPageSize(50), true);
    assert.equal(isAdminPageSize(100), true);
    assert.equal(isAdminPageSize(0), false);
    assert.equal(isAdminPageSize(200), false);
  });
});
