import assert from "node:assert/strict";
import test from "node:test";
import { profileUrlFromDeepLink } from "./profileDeepLink";

test("프로필 딥링크는 앱 WebView의 로그인 보호 프로필 URL로 변환한다", () => {
  assert.equal(
    profileUrlFromDeepLink(
      "blending://profile/barista%20%2F%201",
      "https://blending.example",
    ),
    "https://blending.example/profile/barista%20%2F%201",
  );
});

test("프로필 딥링크가 아닌 URL은 WebView source로 변환하지 않는다", () => {
  assert.equal(
    profileUrlFromDeepLink(
      "blending://settings/account",
      "https://blending.example",
    ),
    null,
  );
  assert.equal(
    profileUrlFromDeepLink(
      "https://external.example/profile/a",
      "https://blending.example",
    ),
    null,
  );
});
