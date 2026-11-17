import assert from "node:assert/strict";
import test from "node:test";
import { profileQrUrl } from "./profileQrUrl";

test("프로필 QR은 공개 스마트 링크와 인코딩된 ID를 사용한다", () => {
  assert.equal(
    profileQrUrl("https://blending.example", "barista / 1"),
    "https://blending.example/open/profile/barista%20%2F%201",
  );
});
