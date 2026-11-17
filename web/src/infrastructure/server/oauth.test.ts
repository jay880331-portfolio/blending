import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest, NextResponse } from "next/server";
import {
  clearOAuthStateCookies,
  setOAuthStateCookie,
  validOAuthState,
} from "./oauth";

test("OAuth 콜백은 시작 단계에서 설정한 state를 요구한다", () => {
  const response = new NextResponse();
  setOAuthStateCookie(response, "kakao", "oauth-state");

  const acceptedRequest = new NextRequest("https://blending.test/callback", {
    headers: { cookie: "blending_oauth_kakao=oauth-state" },
  });
  const missingRequest = new NextRequest("https://blending.test/callback");

  assert.equal(validOAuthState(acceptedRequest, "kakao", "oauth-state"), true);
  assert.equal(validOAuthState(missingRequest, "kakao", "oauth-state"), false);

  clearOAuthStateCookies(response, "kakao");
  assert.equal(response.cookies.get("blending_oauth_kakao")?.value, "");
});
