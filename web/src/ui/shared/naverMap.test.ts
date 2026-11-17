import assert from "node:assert/strict";
import { it } from "node:test";
import { naverLogoControlOptions } from "./naverMap";

const maps = { Position: { TOP_LEFT: 1 } };

it("hides the Naver logo control while the barista directory is open", () => {
  assert.deepEqual(naverLogoControlOptions(maps, false), {
    logoControl: false,
  });
});

it("restores the top-left Naver logo control on the map screen", () => {
  assert.deepEqual(naverLogoControlOptions(maps, true), {
    logoControl: true,
    logoControlOptions: { position: maps.Position.TOP_LEFT },
  });
});
