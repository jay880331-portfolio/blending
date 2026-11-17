import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest, NextResponse } from "next/server";
import {
  TERMS_VERSION,
  currentTermsAcceptance,
  hasCurrentTermsAcceptance,
  hasCurrentTermsAgreement,
  termsConsentRequiredResponse,
} from "./terms";
import {
  SESSION_COOKIE,
  TERMS_CONSENT_COOKIE,
  attachUserSession,
  createUserDocument,
  setSessionCookie,
  signTermsConsent,
  verifySession,
  verifyTermsConsent,
} from "./auth";

test("명시적 약관 동의만 현재 약관 동의로 인정한다", () => {
  assert.equal(hasCurrentTermsAgreement(undefined), false);
  assert.equal(hasCurrentTermsAgreement(false), false);
  assert.equal(hasCurrentTermsAgreement(true), true);
});

test("미동의 인증 요청은 명확한 400 코드로 거절한다", async () => {
  const response = termsConsentRequiredResponse();

  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "TERMS_CONSENT_REQUIRED");
});

test("현재 약관 동의 여부를 버전과 동의 시각으로 판별한다", () => {
  const acceptedAt = new Date("2026-07-31T00:00:00.000Z");

  assert.equal(hasCurrentTermsAcceptance(undefined), false);
  assert.equal(
    hasCurrentTermsAcceptance({ termsAcceptedVersion: TERMS_VERSION }),
    false,
  );
  assert.equal(
    hasCurrentTermsAcceptance({
      termsAcceptedVersion: "outdated",
      termsAcceptedAt: acceptedAt,
    }),
    false,
  );
  assert.equal(
    hasCurrentTermsAcceptance({
      termsAcceptedVersion: TERMS_VERSION,
      termsAcceptedAt: acceptedAt,
    }),
    true,
  );
});

test("성공한 인증에 저장할 약관 동의는 현재 버전과 시각을 가진다", () => {
  const acceptedAt = new Date("2026-07-31T00:00:00.000Z");

  assert.deepEqual(currentTermsAcceptance(acceptedAt), {
    termsAcceptedVersion: TERMS_VERSION,
    termsAcceptedAt: acceptedAt,
  });

  const user = createUserDocument({
    name: "약관 동의 사용자",
    termsAcceptance: currentTermsAcceptance(acceptedAt),
  });
  assert.equal(user.termsAcceptedVersion, TERMS_VERSION);
  assert.equal(user.termsAcceptedAt, acceptedAt);
});

test("약관 동의용 임시 토큰은 앱 세션으로 사용할 수 없다", () => {
  const token = signTermsConsent("existing-user", "phone");

  assert.equal(verifySession(token), null);
  assert.deepEqual(verifyTermsConsent(token), {
    userId: "existing-user",
    method: "phone",
  });
});

test("미동의 계정 인증은 이전 앱 세션을 지우고 임시 동의 쿠키만 남긴다", async () => {
  const response = new NextResponse();
  setSessionCookie(response, "previous-user");

  await attachUserSession(
    new NextRequest("https://blending.test/api/auth/login"),
    response,
    createUserDocument({ name: "미동의 사용자" }),
    "phone",
  );

  assert.equal(response.cookies.get(SESSION_COOKIE)?.value, "");
  assert.ok(response.cookies.get(TERMS_CONSENT_COOKIE)?.value);
});
