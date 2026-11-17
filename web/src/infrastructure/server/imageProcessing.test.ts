import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { prepareImageForUpload } from "./imageProcessing";

describe("prepareImageForUpload", () => {
  it("converts uploaded images to resized webp objects", async () => {
    const original = await sharp({
      create: {
        width: 2400,
        height: 1200,
        channels: 3,
        background: "#f5f0e8",
      },
    })
      .jpeg()
      .toBuffer();
    const file = new File([new Uint8Array(original)], "sample.photo.jpg", {
      type: "image/jpeg",
    });

    const prepared = await prepareImageForUpload(file);
    const metadata = await sharp(prepared.buffer).metadata();

    assert.equal(prepared.contentType, "image/webp");
    assert.equal(prepared.name, "sample.photo.webp");
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 1920);
    assert.equal(metadata.height, 960);
    assert.ok(prepared.size < original.length);
  });
});
