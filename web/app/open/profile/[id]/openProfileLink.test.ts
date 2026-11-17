import assert from "node:assert/strict";
import test from "node:test";
import {
  androidProfileIntent,
  profileDeepLink,
  profileWebHref,
} from "./openProfileLink";

test("공개 프로필 링크는 앱 스킴과 로그인 보호 웹 프로필 경로를 구분한다", () => {
  assert.equal(
    profileDeepLink("barista / 1"),
    "blending://profile/barista%20%2F%201",
  );
  assert.equal(profileWebHref("barista / 1"), "/profile/barista%20%2F%201");
});

test("Android 공개 프로필 링크는 앱 패키지와 Play Store 폴백을 포함한다", () => {
  assert.equal(
    androidProfileIntent("member-1"),
    "intent://profile/member-1#Intent;scheme=blending;package=com.blending.app;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.blending.app;end",
  );
});
