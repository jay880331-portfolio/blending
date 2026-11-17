import { type NextRequest, NextResponse } from "next/server";
import {
  attachSocialSession,
  clearOAuthStateCookies,
  createPendingSocialSignup,
  exchangeSocialCode,
  findSocialUser,
  isSocialProvider,
  setPendingSocialSignupCookie,
  validOAuthState,
} from "@/infrastructure/server/oauth";
import { jsonError } from "@/infrastructure/server/http";
import { requiresTermsConsent } from "@/infrastructure/server/auth";

type Params = Promise<{ provider: string }>;

function redirectToLogin(request: NextRequest, reason: string) {
  const url = new URL("/login", request.nextUrl.origin);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { provider } = await params;
  if (!isSocialProvider(provider))
    return jsonError("지원하지 않는 소셜 로그인입니다.", 404);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  return handleCallback(request, provider, code, state, error);
}

async function handleCallback(
  request: NextRequest,
  provider: "kakao" | "naver" | "apple",
  code: string | null,
  state: string | null,
  error: string | null,
) {
  if (error) return redirectToLogin(request, `${provider}_oauth_cancelled`);
  if (!code || !validOAuthState(request, provider, state))
    return redirectToLogin(request, `${provider}_oauth_invalid`);

  try {
    const profile = await exchangeSocialCode(
      request,
      provider,
      code,
      state ?? "",
    );
    const user = await findSocialUser(profile);
    if (!user) {
      const token = await createPendingSocialSignup(profile);
      const response = NextResponse.redirect(
        new URL(`/login/social/${provider}`, request.nextUrl.origin),
      );
      setPendingSocialSignupCookie(response, token);
      clearOAuthStateCookies(response, provider);
      return response;
    }

    const response = NextResponse.redirect(
      new URL(
        requiresTermsConsent(user) ? "/login/consent" : "/home",
        request.nextUrl.origin,
      ),
    );
    await attachSocialSession(request, response, user, provider);
    return response;
  } catch (error) {
    console.error(`[social-auth] ${provider} callback failed`, error);
    return redirectToLogin(request, `${provider}_oauth_failed`);
  }
}

export async function POST(request: NextRequest, context: { params: Params }) {
  const { provider } = await context.params;
  if (!isSocialProvider(provider))
    return jsonError("지원하지 않는 소셜 로그인입니다.", 404);

  const formData = await request.formData();
  return handleCallback(
    request,
    provider,
    String(formData.get("code") ?? ""),
    String(formData.get("state") ?? ""),
    String(formData.get("error") ?? ""),
  );
}
