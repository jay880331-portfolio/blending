import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterImageFiles, moveImage } from "./imageAttachments";

function imageFile(name: string, type: string, size: number) {
  return { name, type, size } as File;
}

describe("filterImageFiles", () => {
  it("keeps only JPG or PNG files within the size limit", () => {
    const errors: string[] = [];

    assert.deepEqual(
      filterImageFiles(
        [
          imageFile("valid.jpg", "image/jpeg", 8),
          imageFile("unsupported.webp", "image/webp", 8),
          imageFile("large.png", "image/png", 9),
        ],
        8,
        (message) => errors.push(message),
      ).map((file) => file.name),
      ["valid.jpg"],
    );
    assert.deepEqual(errors, [
      "JPG, PNG 이미지만 첨부할 수 있습니다.",
      "이미지 용량이 큽니다. 8MB 이하 이미지로 다시 첨부해주세요.",
    ]);
  });
});

describe("moveImage", () => {
  it("moves an image while keeping every other image in order", () => {
    assert.deepEqual(moveImage(["first", "second", "third"], 2, 0), [
      "third",
      "first",
      "second",
    ]);
  });

  it("keeps the original list for invalid positions", () => {
    const images = ["first", "second"];

    assert.equal(moveImage(images, -1, 1), images);
  });
});
