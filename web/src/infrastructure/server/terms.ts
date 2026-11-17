import { NextResponse } from "next/server";

export const TERMS_VERSION = "2026-07-31";
export const TERMS_CONSENT_REQUIRED_CODE = "TERMS_CONSENT_REQUIRED";

export type TermsAcceptance = {
  termsAcceptedVersion: typeof TERMS_VERSION;
  termsAcceptedAt: Date;
};

export function hasCurrentTermsAgreement(value: unknown): value is true {
  return value === true;
}

export function hasCurrentTermsAcceptance(
  value:
    | { termsAcceptedVersion?: unknown; termsAcceptedAt?: unknown }
    | null
    | undefined,
) {
  return (
    value?.termsAcceptedVersion === TERMS_VERSION &&
    value.termsAcceptedAt instanceof Date &&
    !Number.isNaN(value.termsAcceptedAt.getTime())
  );
}

export function currentTermsAcceptance(now = new Date()): TermsAcceptance {
  return {
    termsAcceptedVersion: TERMS_VERSION,
    termsAcceptedAt: now,
  };
}

export function termsConsentRequiredResponse() {
  return NextResponse.json(
    {
      code: TERMS_CONSENT_REQUIRED_CODE,
      message: "서비스 이용약관과 커뮤니티 운영정책에 동의해주세요.",
    },
    { status: 400 },
  );
}
