import { strict as assert } from "node:assert";
import { it } from "node:test";
import { getPageWindow, patchListQuery } from "./listQuery";
it("resets page", () =>
  assert.equal(patchListQuery("?q=old&page=4", { q: "new" }), "?q=new&page=1"));
it("window", () => assert.deepEqual(getPageWindow(5, 10), [3, 4, 5, 6, 7]));
