import { type NextRequest, NextResponse } from "next/server";
import type { PublicMemberRole } from "@/domain/member/types";
import {
  attachSocialSession,
  completePendingSocialSignup,
  pendingSocialSignupToken,
} from "@/infrastructure/server/oauth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import {
  hasCurrentTermsAgreement,
  termsConsentRequiredResponse,
} from "@/infrastructure/server/terms";
import { requiresTermsConsent } from "@/infrastructure/server/auth";

type CompleteSocialSignupRequest = {
  role: PublicMemberRole;
  termsAccepted: boolean;
};

export async function POST(request: NextRequest) {
  const token = pendingSocialSignupToken(request);
  if (!token) return jsonError("소셜 가입 정보가 만료되었습니다.", 401);

  const body = await readJson<CompleteSocialSignupRequest>(request);
  if (
    body.role !== "barista" &&
    body.role !== "enthusiast" &&
    body.role !== "partner"
  )
    return jsonError("회원 유형을 선택해주세요.");
  if (!hasCurrentTermsAgreement(body.termsAccepted))
    return termsConsentRequiredResponse();

  const completed = await completePendingSocialSignup(token, body.role);
  if (!completed) return jsonError("소셜 가입 정보가 만료되었습니다.", 401);

  const { provider: method, user } = completed;

  const response = NextResponse.json({
    success: true,
    method,
    nextPath: requiresTermsConsent(user) ? "/login/consent" : "/home",
  });
  await attachSocialSession(request, response, user, method);
  return response;
}
