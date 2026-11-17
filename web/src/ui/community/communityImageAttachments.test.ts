import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCommunityImagePayload,
  mergeCommunityImageAttachments,
} from "./communityImageAttachments";

describe("mergeCommunityImageAttachments", () => {
  it("appends selected images as one ordered attachment list up to six items", () => {
    assert.deepEqual(
      mergeCommunityImageAttachments(
        ["a.jpg", "b.jpg"],
        ["c.jpg", "d.jpg", "e.jpg", "f.jpg", "g.jpg"],
      ),
      ["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg"],
    );
  });
});

describe("buildCommunityImagePayload", () => {
  it("keeps existing images before newly uploaded images", () => {
    assert.deepEqual(
      buildCommunityImagePayload({
        uploadedImageUrls: ["new-1.jpg", "new-2.jpg"],
        existingImageUrls: ["old.jpg"],
      }),
      {
        coverUrl: "old.jpg",
        imageUrl: "old.jpg",
        imageUrls: ["old.jpg", "new-1.jpg", "new-2.jpg"],
      },
    );
  });

  it("keeps existing images when no new image is uploaded", () => {
    assert.deepEqual(
      buildCommunityImagePayload({
        uploadedImageUrls: [],
        existingImageUrls: ["old-1.jpg", "old-2.jpg"],
      }),
      {
        coverUrl: "old-1.jpg",
        imageUrl: "old-1.jpg",
        imageUrls: ["old-1.jpg", "old-2.jpg"],
      },
    );
  });
});
