import { type NextRequest, NextResponse } from "next/server";
import type { NativeAppleFullName } from "@blending/bridge";
import {
  attachSocialSession,
  clearAppleNativeChallenge,
  createPendingSocialSignup,
  fetchAppleNativeProfile,
  fetchSocialProfileWithAccessToken,
  findSocialUser,
  setPendingSocialSignupCookie,
  validAppleNativeChallenge,
} from "@/infrastructure/server/oauth";
import { requiresTermsConsent } from "@/infrastructure/server/auth";
import {
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";

type NativeSocialLoginRequest = {
  provider: "kakao" | "naver" | "apple";
  accessToken?: string;
  identityToken?: string;
  nonce?: string;
  state?: string;
  credentialState?: string | null;
  authorizationCode?: string | null;
  user?: string;
  email?: string | null;
  fullName?: NativeAppleFullName | null;
};

function isNativeSocialProvider(
  value: unknown,
): value is NativeSocialLoginRequest["provider"] {
  return value === "kakao" || value === "naver" || value === "apple";
}

export async function POST(request: NextRequest) {
  const body = await readJson<NativeSocialLoginRequest>(request);
  if (!isNativeSocialProvider(body.provider)) {
    return jsonError("지원하지 않는 앱 소셜 로그인입니다.", 400);
  }
  if (body.provider === "apple") {
    return handleAppleNativeLogin(request, body);
  }

  const accessToken = requireString(body.accessToken);
  if (!accessToken) {
    return jsonError("소셜 로그인 토큰이 없습니다.", 400);
  }

  try {
    const profile = await fetchSocialProfileWithAccessToken(
      body.provider,
      accessToken,
    );
    const user = await findSocialUser(profile);

    if (!user) {
      const token = await createPendingSocialSignup(profile);
      const response = NextResponse.json({
        success: true,
        method: body.provider,
        nextPath: `/login/social/${body.provider}`,
      });
      setPendingSocialSignupCookie(response, token);
      return response;
    }

    const response = NextResponse.json({
      success: true,
      method: body.provider,
      nextPath: requiresTermsConsent(user) ? "/login/consent" : "/home",
    });
    await attachSocialSession(request, response, user, body.provider);
    return response;
  } catch (error) {
    console.error(`[social-auth] ${body.provider} native login failed`, error);
    return jsonError("앱 소셜 로그인에 실패했습니다.", 401);
  }
}

async function handleAppleNativeLogin(
  request: NextRequest,
  body: Partial<NativeSocialLoginRequest>,
) {
  const identityToken = requireString(body.identityToken);
  const nonce = requireString(body.nonce);
  const state = requireString(body.state);
  const challenge = nonce && state ? { nonce, state } : null;

  if (
    !identityToken ||
    !challenge ||
    body.credentialState !== state ||
    !validAppleNativeChallenge(request, challenge)
  ) {
    const response = jsonError("Apple 로그인 요청을 확인할 수 없습니다.", 401);
    clearAppleNativeChallenge(response);
    return response;
  }
  const { nonce: appleNonce } = challenge;

  try {
    const profile = await fetchAppleNativeProfile({
      identityToken,
      nonce: appleNonce,
      fullName: body.fullName,
    });
    const user = await findSocialUser(profile);

    if (!user) {
      const token = await createPendingSocialSignup(profile);
      const response = NextResponse.json({
        success: true,
        method: "apple",
        nextPath: "/login/social/apple",
      });
      setPendingSocialSignupCookie(response, token);
      clearAppleNativeChallenge(response);
      return response;
    }

    const response = NextResponse.json({
      success: true,
      method: "apple",
      nextPath: requiresTermsConsent(user) ? "/login/consent" : "/home",
    });
    await attachSocialSession(request, response, user, "apple");
    clearAppleNativeChallenge(response);
    return response;
  } catch (error) {
    console.error("[social-auth] apple native login failed", error);
    const response = jsonError("Apple 로그인에 실패했습니다.", 401);
    clearAppleNativeChallenge(response);
    return response;
  }
}
