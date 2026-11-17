import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMMUNITY_IMAGE_SLIDE_LIMIT,
  getNearestCommunityImageSlideIndex,
  visibleCommunityImages,
} from "./communityImageSlider";

describe("visibleCommunityImages", () => {
  it("keeps the same six-image limit used by community posts", () => {
    assert.deepEqual(
      visibleCommunityImages(["1", "2", "3", "4", "5", "6", "7"]),
      ["1", "2", "3", "4", "5", "6"],
    );
    assert.equal(COMMUNITY_IMAGE_SLIDE_LIMIT, 6);
  });

  it("Daily Note에서는 최대 10장을 유지한다", () => {
    const images = Array.from({ length: 10 }, (_, index) => `${index + 1}`);
    assert.deepEqual(visibleCommunityImages(images, 10), images);
    assert.deepEqual(visibleCommunityImages(images, 8), images.slice(0, 8));
  });
});

describe("getNearestCommunityImageSlideIndex", () => {
  it("returns the slide whose offset is closest to the current scroll position", () => {
    assert.equal(getNearestCommunityImageSlideIndex(260, [0, 240, 480]), 1);
    assert.equal(getNearestCommunityImageSlideIndex(410, [0, 240, 480]), 2);
  });

  it("returns the first slide when offsets are empty", () => {
    assert.equal(getNearestCommunityImageSlideIndex(200, []), 0);
  });
});
