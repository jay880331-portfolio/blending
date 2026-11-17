import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  clearTermsConsentCookie,
  pendingTermsConsent,
  recordLoginMethod,
  recordTermsAcceptance,
  setSessionCookie,
  usersCollection,
} from "@/infrastructure/server/auth";
import { isActiveAccount } from "@/infrastructure/server/accountStatus";
import { jsonError, readJson } from "@/infrastructure/server/http";
import { isLoginAllowed } from "@/infrastructure/server/sanctions";
import {
  hasCurrentTermsAgreement,
  termsConsentRequiredResponse,
} from "@/infrastructure/server/terms";

type AcceptTermsRequest = {
  termsAccepted: boolean;
};

export async function POST(request: NextRequest) {
  const body = await readJson<AcceptTermsRequest>(request);
  if (!hasCurrentTermsAgreement(body.termsAccepted))
    return termsConsentRequiredResponse();

  const pending = pendingTermsConsent(request);
  if (!pending) return jsonError("로그인 정보를 다시 확인해주세요.", 401);

  const user = await (await usersCollection()).findOne({ id: pending.userId });
  if (!user || !isActiveAccount(user))
    return jsonError("로그인 정보를 다시 확인해주세요.", 401);
  if (!(await isLoginAllowed(user.id)))
    return jsonError("제재 중인 계정입니다.", 403);

  await recordTermsAcceptance(user.id);
  const response = NextResponse.json({
    success: true,
    method: pending.method,
    user: { id: user.id, name: user.name },
  });
  await recordLoginMethod({
    request,
    response,
    userId: user.id,
    method: pending.method,
  });
  setSessionCookie(response, user.id);
  clearTermsConsentCookie(response);
  return response;
}
