import { type NextRequest, NextResponse } from "next/server";
import {
  createAuthorizationUrl,
  isSocialProvider,
  setOAuthStateCookie,
} from "@/infrastructure/server/oauth";
import { jsonError } from "@/infrastructure/server/http";

type Params = Promise<{ provider: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { provider } = await params;
  if (!isSocialProvider(provider))
    return jsonError("지원하지 않는 소셜 로그인입니다.", 404);

  try {
    const { url, state, nonce } = createAuthorizationUrl(request, provider);
    const response = NextResponse.redirect(url);
    setOAuthStateCookie(response, provider, state, nonce);
    return response;
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "소셜 로그인 설정을 확인해주세요.",
      500,
    );
  }
}
