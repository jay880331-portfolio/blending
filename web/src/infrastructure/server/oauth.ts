import { randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import type { NativeAppleFullName } from "@blending/bridge";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { profileFromUser } from "@/infrastructure/mongodb/memberMongoRepository";
import { syncProfileSearchDocument } from "@/infrastructure/mongodb/searchMongoRepository";
import {
  attachUserSession,
  createUserDocument,
  type AuthProvider,
  type LoginMethod,
  type SocialAccount,
  type UserDocument,
  usersCollection,
} from "@/infrastructure/server/auth";
import { requireLoginAllowed } from "@/infrastructure/server/sanctions";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import type { MemberProfile, PublicMemberRole } from "@/domain/member/types";
import { isActiveAccount } from "@/infrastructure/server/accountStatus";
import { verifyAppleIdentityToken } from "@/infrastructure/server/appleAuthentication";
import { currentTermsAcceptance } from "@/infrastructure/server/terms";

export type SocialProvider = Exclude<AuthProvider, "phone">;

type SocialProfile = {
  provider: SocialProvider;
  providerId: string;
  name: string;
  email?: string;
  avatarUrl?: string;
};

type TokenResponse = {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type KakaoProfile = {
  id?: number;
  properties?: {
    nickname?: string;
    profile_image?: string;
  };
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
  };
};

type NaverProfile = {
  resultcode?: string;
  response?: {
    id?: string;
    nickname?: string;
    name?: string;
    email?: string;
    profile_image?: string;
  };
};

type ProviderConfig = {
  clientId?: string;
  clientSecret?: string;
  scope: string;
  authorizeUrl: string;
  tokenUrl: string;
};

export function isSocialProvider(value: string): value is SocialProvider {
  return value === "kakao" || value === "naver" || value === "apple";
}

function siteOrigin(request: NextRequest) {
  return process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
}

export function socialRedirectUri(
  request: NextRequest,
  provider: SocialProvider,
) {
  return `${siteOrigin(request)}/api/auth/social/${provider}/callback`;
}

function providerConfig(provider: SocialProvider): ProviderConfig {
  if (provider === "kakao") {
    return {
      clientId: process.env.KAKAO_CLIENT_ID,
      clientSecret: process.env.KAKAO_CLIENT_SECRET,
      scope: "profile_nickname profile_image",
      authorizeUrl: "https://kauth.kakao.com/oauth/authorize",
      tokenUrl: "https://kauth.kakao.com/oauth/token",
    };
  }

  if (provider === "naver") {
    return {
      clientId: process.env.NAVER_CLIENT_ID,
      clientSecret: process.env.NAVER_CLIENT_SECRET,
      scope: "name email profile_image",
      authorizeUrl: "https://nid.naver.com/oauth2.0/authorize",
      tokenUrl: "https://nid.naver.com/oauth2.0/token",
    };
  }

  return {
    clientId: process.env.APPLE_CLIENT_ID,
    clientSecret: process.env.APPLE_CLIENT_SECRET,
    scope: "name email",
    authorizeUrl: "https://appleid.apple.com/auth/authorize",
    tokenUrl: "https://appleid.apple.com/auth/token",
  };
}

export function createAuthorizationUrl(
  request: NextRequest,
  provider: SocialProvider,
) {
  const config = providerConfig(provider);
  if (!config.clientId)
    throw new Error(`${provider.toUpperCase()}_CLIENT_ID is not configured.`);

  const state = randomBytes(16).toString("hex");
  const nonce =
    provider === "apple" ? randomBytes(32).toString("base64url") : undefined;
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", socialRedirectUri(request, provider));
  url.searchParams.set("state", state);
  url.searchParams.set("scope", config.scope);

  if (provider === "apple") {
    if (!nonce) throw new Error("Apple nonce를 생성하지 못했습니다.");
    url.searchParams.set("response_mode", "form_post");
    url.searchParams.set("nonce", nonce);
  }

  return { url, state, nonce };
}

export function setOAuthStateCookie(
  response: NextResponse,
  provider: SocialProvider,
  state: string,
  nonce?: string,
) {
  response.cookies.set(`blending_oauth_${provider}`, state, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/",
    sameSite: provider === "apple" ? "none" : "lax",
    secure: provider === "apple" || process.env.NODE_ENV === "production",
  });
  if (provider === "apple" && nonce) {
    response.cookies.set("blending_oauth_apple_nonce", nonce, {
      httpOnly: true,
      maxAge: 60 * 10,
      path: "/",
      sameSite: "none",
      secure: true,
    });
  }
}

export function validOAuthState(
  request: NextRequest,
  provider: SocialProvider,
  state: string | null,
) {
  return Boolean(
    state && request.cookies.get(`blending_oauth_${provider}`)?.value === state,
  );
}

export function clearOAuthStateCookies(
  response: NextResponse,
  provider: SocialProvider,
) {
  response.cookies.delete(`blending_oauth_${provider}`);
  if (provider === "apple")
    response.cookies.delete("blending_oauth_apple_nonce");
}

function appleOAuthNonce(request: NextRequest) {
  return request.cookies.get("blending_oauth_apple_nonce")?.value ?? null;
}

export function createAppleNativeChallenge() {
  return {
    nonce: randomBytes(32).toString("base64url"),
    state: randomBytes(16).toString("hex"),
  };
}

export function setAppleNativeChallengeCookie(
  response: NextResponse,
  challenge: { nonce: string; state: string },
) {
  response.cookies.set(
    "blending_native_apple",
    `${challenge.state}.${challenge.nonce}`,
    {
      httpOnly: true,
      maxAge: 60 * 10,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  );
}

export function validAppleNativeChallenge(
  request: NextRequest,
  challenge: { nonce: string; state: string },
) {
  return (
    request.cookies.get("blending_native_apple")?.value ===
    `${challenge.state}.${challenge.nonce}`
  );
}

export function clearAppleNativeChallenge(response: NextResponse) {
  response.cookies.delete("blending_native_apple");
}

export async function exchangeSocialCode(
  request: NextRequest,
  provider: SocialProvider,
  code: string,
  state: string,
) {
  const config = providerConfig(provider);
  if (!config.clientId)
    throw new Error(`${provider.toUpperCase()}_CLIENT_ID is not configured.`);
  if ((provider === "naver" || provider === "apple") && !config.clientSecret) {
    throw new Error(
      `${provider.toUpperCase()}_CLIENT_SECRET is not configured.`,
    );
  }

  const params = new URLSearchParams();
  params.set("grant_type", "authorization_code");
  params.set("client_id", config.clientId);
  params.set("redirect_uri", socialRedirectUri(request, provider));
  params.set("code", code);
  if (provider === "naver") params.set("state", state);
  if (config.clientSecret) params.set("client_secret", config.clientSecret);

  const tokenUrl =
    provider === "naver"
      ? `${config.tokenUrl}?${params.toString()}`
      : config.tokenUrl;
  const tokenResponse = await fetch(tokenUrl, {
    method: provider === "naver" ? "GET" : "POST",
    headers:
      provider === "naver"
        ? undefined
        : { "Content-Type": "application/x-www-form-urlencoded" },
    body: provider === "naver" ? undefined : params.toString(),
  });
  const token = (await tokenResponse.json()) as TokenResponse;

  if (!token.access_token && !token.id_token) {
    throw new Error(
      token.error_description || `${provider} token exchange failed.`,
    );
  }

  return fetchSocialProfile(
    provider,
    token,
    provider === "apple" ? (appleOAuthNonce(request) ?? undefined) : undefined,
  );
}

async function fetchSocialProfile(
  provider: SocialProvider,
  token: TokenResponse,
  nonce?: string,
): Promise<SocialProfile> {
  if (provider === "kakao") {
    const response = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const profile = (await response.json()) as KakaoProfile;
    if (!profile.id)
      throw new Error("카카오 사용자 정보를 가져오지 못했습니다.");

    return {
      provider,
      providerId: `kakao_${profile.id}`,
      name:
        profile.kakao_account?.profile?.nickname ??
        profile.properties?.nickname ??
        "카카오 사용자",
      email: profile.kakao_account?.email,
      avatarUrl:
        profile.kakao_account?.profile?.profile_image_url ??
        profile.properties?.profile_image,
    };
  }

  if (provider === "naver") {
    const response = await fetch("https://openapi.naver.com/v1/nid/me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const profile = (await response.json()) as NaverProfile;
    if (profile.resultcode !== "00" || !profile.response?.id)
      throw new Error("네이버 사용자 정보를 가져오지 못했습니다.");

    return {
      provider,
      providerId: `naver_${profile.response.id}`,
      name:
        profile.response.name ?? profile.response.nickname ?? "네이버 사용자",
      email: profile.response.email,
      avatarUrl: profile.response.profile_image,
    };
  }

  if (!token.id_token || !nonce)
    throw new Error("애플 identity token 또는 nonce가 없습니다.");
  const claims = await verifyAppleIdentityToken(
    token.id_token,
    providerConfig("apple").clientId ?? "",
    nonce,
  );

  return {
    provider,
    providerId: `apple_${claims.sub}`,
    name: claims.email?.split("@")[0] ?? "Apple 사용자",
    email: claims.email,
  };
}

export function fetchSocialProfileWithAccessToken(
  provider: Extract<SocialProvider, "kakao" | "naver">,
  accessToken: string,
) {
  return fetchSocialProfile(provider, { access_token: accessToken });
}

export async function fetchAppleNativeProfile({
  identityToken,
  nonce,
  fullName,
}: {
  identityToken: string;
  nonce: string;
  fullName?: NativeAppleFullName | null;
}): Promise<SocialProfile> {
  const claims = await verifyAppleIdentityToken(
    identityToken,
    "com.blending.app",
    nonce,
  );
  const name = [fullName?.givenName, fullName?.familyName]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    )
    .join(" ");

  return {
    provider: "apple",
    providerId: `apple_${claims.sub}`,
    name: name || claims.email?.split("@")[0] || "Apple 사용자",
    email: claims.email,
  };
}

export async function findSocialUser(profile: SocialProfile) {
  await ensureMongoIndexes();
  const users = await usersCollection();
  const socialAccount = socialAccountFromProfile(profile);

  const existingUser = await users.findOne({
    socialAccounts: {
      $elemMatch: {
        provider: socialAccount.provider,
        providerId: socialAccount.providerId,
      },
    },
  });

  if (existingUser) {
    if (!isActiveAccount(existingUser))
      throw new Error("비활성화된 계정입니다.");
    await ensureProfileForUser(existingUser);
    return existingUser;
  }

  return null;
}

export async function createPendingSocialSignup(profile: SocialProfile) {
  const db = await getMongoDb();
  const token = randomBytes(32).toString("hex");
  const now = new Date();

  await db.collection("pending_social_signups").insertOne({
    token,
    profile,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
  });

  return token;
}

export function setPendingSocialSignupCookie(
  response: NextResponse,
  token: string,
) {
  response.cookies.set("blending_social_signup", token, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function pendingSocialSignupToken(request: NextRequest) {
  return request.cookies.get("blending_social_signup")?.value ?? null;
}

export async function completePendingSocialSignup(
  token: string,
  role: PublicMemberRole,
) {
  const db = await getMongoDb();
  const pending = await db
    .collection<{
      token: string;
      profile: SocialProfile;
      expiresAt: Date;
    }>("pending_social_signups")
    .findOneAndDelete({
      token,
      expiresAt: { $gt: new Date() },
    });

  if (!pending) return null;

  const provider = pending.profile.provider;
  const existingUser = await findSocialUser(pending.profile);
  if (existingUser) return { provider, user: existingUser };

  await ensureMongoIndexes();
  const users = await usersCollection();
  const socialAccount = socialAccountFromProfile(pending.profile);
  const user = createUserDocument({
    name: pending.profile.name,
    avatarUrl: pending.profile.avatarUrl,
    socialAccount,
    role,
    termsAcceptance: currentTermsAcceptance(),
  });

  try {
    await users.insertOne(user);
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;

    const racedUser = await users.findOne({
      socialAccounts: {
        $elemMatch: {
          provider: socialAccount.provider,
          providerId: socialAccount.providerId,
        },
      },
    });
    if (!racedUser) throw error;
    if (!isActiveAccount(racedUser)) throw new Error("비활성화된 계정입니다.");
    await ensureProfileForUser(racedUser);
    return { provider, user: racedUser };
  }

  await ensureProfileForUser(user);
  return { provider, user };
}

function socialAccountFromProfile(profile: SocialProfile): SocialAccount {
  const socialAccount: SocialAccount = {
    provider: profile.provider,
    providerId: profile.providerId,
  };
  if (profile.email) socialAccount.email = profile.email;
  return socialAccount;
}

async function ensureProfileForUser(user: UserDocument) {
  const db = await getMongoDb();
  const profiles = db.collection<MemberProfile & { ownerId?: string }>(
    "member_profiles",
  );
  await profiles.updateOne(
    { ownerId: user.id },
    { $setOnInsert: profileFromUser(user) },
    { upsert: true },
  );
  const profile = await profiles.findOne({ ownerId: user.id });
  if (profile) await syncProfileSearchDocument(profile);
}

function isDuplicateKey(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

export async function attachSocialSession(
  request: NextRequest,
  response: NextResponse,
  user: UserDocument,
  method: LoginMethod,
) {
  await requireLoginAllowed(user.id);
  const sessionAttached = await attachUserSession(
    request,
    response,
    user,
    method,
  );
  for (const provider of ["kakao", "naver", "apple"] as const) {
    clearOAuthStateCookies(response, provider);
  }
  response.cookies.delete("blending_native_apple");
  response.cookies.delete("blending_social_signup");
  return sessionAttached;
}
