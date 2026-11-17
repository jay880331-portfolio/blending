import { strict as assert } from "node:assert";
import { it } from "node:test";
import { buildLinePoints } from "./chartGeometry";
it("equal values", () =>
  assert.deepEqual(buildLinePoints([5, 5], 100, 40), ["0,20", "100,20"]));
