import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isActivePopupImageReady,
  popupActiveSlideIndex,
  isAppPopupSuppressed,
  koreaDateKey,
  popupPlacementForPath,
  popupSlideIndex,
} from "./appPopupState";

describe("app popup state", () => {
  it("maps only bottom navigation domains", () => {
    assert.equal(popupPlacementForPath("/home"), "home");
    assert.equal(popupPlacementForPath("/community/qa"), "community");
    assert.equal(popupPlacementForPath("/profile/member-1"), "map");
    assert.equal(popupPlacementForPath("/home/profile/edit"), null);
    assert.equal(popupPlacementForPath("/home/career/edit"), null);
    assert.equal(popupPlacementForPath("/home/portfolio/new"), null);
    assert.equal(popupPlacementForPath("/community/events/new"), null);
    assert.equal(popupPlacementForPath("/maple"), null);
    assert.equal(popupPlacementForPath("/homework"), null);
    assert.equal(popupPlacementForPath("/communityfoo"), null);
    assert.equal(popupPlacementForPath("/login"), null);
  });

  it("rolls the date at KST midnight", () => {
    assert.equal(
      koreaDateKey(new Date("2026-08-20T14:59:59.000Z")),
      "2026-08-20",
    );
    assert.equal(
      koreaDateKey(new Date("2026-08-20T15:00:00.000Z")),
      "2026-08-21",
    );
  });

  it("suppresses by either today's key or session close", () => {
    const now = new Date("2026-08-20T03:00:00.000Z");
    assert.equal(isAppPopupSuppressed("2026-08-20", false, now), true);
    assert.equal(isAppPopupSuppressed(null, true, now), true);
    assert.equal(isAppPopupSuppressed("2026-08-19", false, now), false);
  });

  it("clamps a scroll position to a carousel index", () => {
    assert.equal(popupSlideIndex(640, 320, 3), 2);
    assert.equal(popupSlideIndex(9999, 320, 3), 2);
  });

  it("clamps the active slide when the last image is removed", () => {
    assert.equal(popupActiveSlideIndex(2, 2), 1);
    assert.equal(popupActiveSlideIndex(0, 0), 0);
  });

  it("returns readiness for the clamped active popup image only", () => {
    const popups = [{ id: "first" }, { id: "second" }];

    assert.equal(isActivePopupImageReady(new Set(), popups, 0), false);
    assert.equal(
      isActivePopupImageReady(new Set(["second"]), popups, 0),
      false,
    );
    assert.equal(isActivePopupImageReady(new Set(["second"]), popups, 9), true);
    assert.equal(isActivePopupImageReady(new Set(["first"]), [], 0), false);
  });
});
