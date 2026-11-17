import assert from "node:assert/strict";
import { it } from "node:test";
import { clampRelatedPage } from "./relatedPagination";

it("moves an emptied related-data page to the last valid page", () => {
  assert.equal(clampRelatedPage(3, 2), 2);
  assert.equal(clampRelatedPage(1, 0), 1);
  assert.equal(clampRelatedPage(2, 4), 2);
});
