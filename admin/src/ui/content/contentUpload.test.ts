import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeUploadedUrls } from "./contentUpload";

test("single image upload replaces the current URL", () => {
  assert.equal(mergeUploadedUrls("old", ["new"], false), "new");
});

test("multiple image upload appends only new URLs", () => {
  assert.equal(mergeUploadedUrls("a\nb", ["b", "c"], true), "a\nb\nc");
});
