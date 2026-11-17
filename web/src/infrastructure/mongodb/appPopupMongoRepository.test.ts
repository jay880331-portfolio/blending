import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activeAppPopupFilter,
  APP_POPUP_SORT,
} from "./appPopupMongoRepository";

describe("activeAppPopupFilter", () => {
  it("uses start-inclusive and end-exclusive schedule filtering", () => {
    const now = "2026-08-20T09:00:00.000Z";
    assert.deepEqual(activeAppPopupFilter("home", now), {
      enabled: true,
      startsAt: { $lte: now },
      endsAt: { $gt: now },
      placements: "home",
    });
    assert.deepEqual(APP_POPUP_SORT, { priority: 1, createdAt: 1 });
  });
});
