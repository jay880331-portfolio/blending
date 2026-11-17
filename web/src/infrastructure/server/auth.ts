import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextRequest, NextResponse } from "next/server";
import type { Collection, WithId } from "mongodb";
import type {
  MemberRole,
  SocialLinks,
  WorkplaceLocation,
} from "@/domain/member/types";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { hasAdminRole } from "@/infrastructure/server/authRole";
import { isActiveAccount } from "@/infrastructure/server/accountStatus";
import { activeAccountFilter } from "@/infrastructure/server/accountStatus";
import { isLoginAllowed } from "@/infrastructure/server/sanctions";
import {
  currentTermsAcceptance,
  hasCurrentTermsAcceptance,
  type TermsAcceptance,
} from "@/infrastructure/server/terms";

const scryptAsync = promisify(scrypt);
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const TERMS_CONSENT_MAX_AGE = 60 * 10;
export const SESSION_COOKIE = "blending_session";
export const TERMS_CONSENT_COOKIE = "blending_terms_consent";

export type AuthProvider = "phone" | "kakao" | "naver" | "apple";
export type LoginMethod = AuthProvider;

export type SocialAccount = {
  provider: Exclude<AuthProvider, "phone">;
  providerId: string;
  email?: string;
};

export type UserDocument = {
  id: string;
  email?: string;
  phone?: string;
  passwordHash?: string;
  lastLoginMethod?: LoginMethod;
  lastLoginAt?: Date;
  lastSeenAt?: Date;
  name: string;
  handle?: string;
  role: MemberRole;
  avatarUrl?: string;
  workplaces: string[];
  workplaceLocations?: WorkplaceLocation[];
  specialties: string[];
  socials: SocialLinks;
  socialAccounts: SocialAccount[];
  accountStatus?: "active" | "suspended" | "deleted" | "deleting";
  accountStatusReason?: string;
  termsAcceptedVersion?: string;
  termsAcceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

type SessionPayload = {
  sub: string;
  iat: number;
  exp: number;
  aud?: "session" | "terms-consent";
  method?: LoginMethod;
};

type RecentLoginDocument = {
  deviceId: string;
  userId: string;
  method: LoginMethod;
  updatedAt: Date;
};

export class LoginInactiveAccountError extends Error {}

const defaultSocials: SocialLinks = {
  instagram: "",
  threads: "",
  website: "",
  recipeUrl: "",
};
export const RECENT_LOGIN_DEVICE_COOKIE = "blending_login_device";
const RECENT_LOGIN_MAX_AGE = 60 * 60 * 24 * 365;

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET ?? process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production")
    throw new Error("AUTH_SECRET environment variable is required.");
  return "blending-development-secret";
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function signValue(value: string) {
  return createHmac("sha256", getAuthSecret())
    .update(value)
    .digest("base64url");
}

function signAuthPayload(payload: SessionPayload) {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const unsigned = `${header}.${encodedPayload}`;
  return `${unsigned}.${signValue(unsigned)}`;
}

function verifyAuthPayload(token: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const unsigned = `${header}.${payload}`;
  const expected = signValue(unsigned);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  )
    return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;
    if (
      !parsed.sub ||
      !parsed.exp ||
      parsed.exp < Math.floor(Date.now() / 1000)
    )
      return null;
    return parsed as SessionPayload;
  } catch {
    return null;
  }
}

export function signSession(userId: string) {
  const now = Math.floor(Date.now() / 1000);
  return signAuthPayload({
    sub: userId,
    iat: now,
    exp: now + SESSION_MAX_AGE,
    aud: "session",
  });
}

export function verifySession(token: string): string | null {
  const payload = verifyAuthPayload(token);
  return payload && payload.aud !== "terms-consent" ? payload.sub : null;
}

export function signTermsConsent(userId: string, method: LoginMethod) {
  const now = Math.floor(Date.now() / 1000);
  return signAuthPayload({
    sub: userId,
    method,
    iat: now,
    exp: now + TERMS_CONSENT_MAX_AGE,
    aud: "terms-consent",
  });
}

export function verifyTermsConsent(token: string) {
  const payload = verifyAuthPayload(token);
  if (payload?.aud !== "terms-consent" || !isLoginMethod(payload.method))
    return null;
  return { userId: payload.sub, method: payload.method };
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const key = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("base64url")}`;
}

export async function comparePassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;

  const inputKey = (await scryptAsync(password, salt, 64)) as Buffer;
  const storedKey = Buffer.from(key, "base64url");
  return (
    inputKey.length === storedKey.length && timingSafeEqual(inputKey, storedKey)
  );
}

export async function usersCollection(): Promise<Collection<UserDocument>> {
  const db = await getMongoDb();
  return db.collection<UserDocument>("users");
}

export async function getCurrentUser(
  request: NextRequest,
): Promise<WithId<UserDocument> | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return token ? getUserFromSessionToken(token) : null;
}

export async function getUserFromSessionToken(
  token: string,
): Promise<WithId<UserDocument> | null> {
  const userId = verifySession(token);
  if (!userId) return null;

  const users = await usersCollection();
  const user = await users.findOne({ id: userId });
  if (!user) return null;
  return isActiveAccount(user) &&
    !requiresTermsConsent(user) &&
    (await isLoginAllowed(user.id))
    ? user
    : null;
}

export async function getCurrentAdminUser(request: NextRequest) {
  const user = await getCurrentUser(request);
  return hasAdminRole(user) ? user : null;
}

export function setSessionCookie(response: NextResponse, userId: string) {
  const expires = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  response.cookies.set(SESSION_COOKIE, signSession(userId), {
    httpOnly: true,
    expires,
    maxAge: SESSION_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function setTermsConsentCookie(
  response: NextResponse,
  userId: string,
  method: LoginMethod,
) {
  response.cookies.set(TERMS_CONSENT_COOKIE, signTermsConsent(userId, method), {
    httpOnly: true,
    maxAge: TERMS_CONSENT_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function pendingTermsConsent(request: NextRequest) {
  const token = request.cookies.get(TERMS_CONSENT_COOKIE)?.value;
  return token ? verifyTermsConsent(token) : null;
}

export function clearTermsConsentCookie(response: NextResponse) {
  response.cookies.set(TERMS_CONSENT_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function setRecentLoginDeviceCookie(
  response: NextResponse,
  deviceId: string,
) {
  response.cookies.set(RECENT_LOGIN_DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    maxAge: RECENT_LOGIN_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function recentLoginDeviceId(request: NextRequest) {
  return request.cookies.get(RECENT_LOGIN_DEVICE_COOKIE)?.value ?? null;
}

export function ensureRecentLoginDevice(
  request: NextRequest,
  response: NextResponse,
) {
  const deviceId =
    recentLoginDeviceId(request) ?? randomBytes(16).toString("hex");
  setRecentLoginDeviceCookie(response, deviceId);
  return deviceId;
}

export function isLoginMethod(value: unknown): value is LoginMethod {
  return (
    value === "phone" ||
    value === "kakao" ||
    value === "naver" ||
    value === "apple"
  );
}

export async function recordLoginMethod({
  request,
  response,
  userId,
  method,
}: {
  request: NextRequest;
  response: NextResponse;
  userId: string;
  method: LoginMethod;
}) {
  const deviceId = ensureRecentLoginDevice(request, response);
  const now = new Date();
  const db = await getMongoDb();

  await recordLoginMetadata(
    db.collection<UserDocument>("users"),
    db.collection<RecentLoginDocument>("auth_recent_logins"),
    { userId, deviceId, method, now },
  );
}

export async function recordLoginMetadata(
  users: Pick<Collection<UserDocument>, "updateOne">,
  recentLogins: Pick<Collection<RecentLoginDocument>, "updateOne">,
  {
    userId,
    deviceId,
    method,
    now,
  }: {
    userId: string;
    deviceId: string;
    method: LoginMethod;
    now: Date;
  },
) {
  const userUpdate = await users.updateOne(
    { id: userId, ...activeAccountFilter() },
    {
      $set: {
        lastLoginMethod: method,
        lastLoginAt: now,
        updatedAt: now,
      },
    },
  );
  if (userUpdate.matchedCount !== 1) throw new LoginInactiveAccountError();

  await recentLogins.updateOne(
    { deviceId },
    {
      $set: {
        deviceId,
        userId,
        method,
        updatedAt: now,
      },
    },
    { upsert: true },
  );
}

export async function recordTermsAcceptance(userId: string) {
  const now = new Date();
  await (
    await usersCollection()
  ).updateOne(
    { id: userId, ...activeAccountFilter() },
    { $set: { ...currentTermsAcceptance(now), updatedAt: now } },
  );
}

export function requiresTermsConsent(
  user: Pick<UserDocument, "termsAcceptedVersion" | "termsAcceptedAt">,
) {
  return !hasCurrentTermsAcceptance(user);
}

export async function attachUserSession(
  request: NextRequest,
  response: NextResponse,
  user: UserDocument,
  method: LoginMethod,
) {
  if (requiresTermsConsent(user)) {
    clearSessionCookie(response);
    setTermsConsentCookie(response, user.id, method);
    return false;
  }

  clearTermsConsentCookie(response);
  await recordLoginMethod({ request, response, userId: user.id, method });
  setSessionCookie(response, user.id);
  return true;
}

export async function recentLoginMethodForDevice(request: NextRequest) {
  const deviceId = recentLoginDeviceId(request);
  if (!deviceId) return null;

  const db = await getMongoDb();
  const recent = await db
    .collection<RecentLoginDocument>("auth_recent_logins")
    .findOne({ deviceId });

  return isLoginMethod(recent?.method) ? recent.method : null;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function createUserDocument(input: {
  email?: string;
  phone?: string;
  passwordHash?: string;
  name: string;
  role?: MemberRole;
  avatarUrl?: string;
  socialAccount?: SocialAccount;
  workplaces?: string[];
  workplaceLocations?: WorkplaceLocation[];
  specialties?: string[];
  termsAcceptance?: TermsAcceptance;
}): UserDocument {
  const now = new Date();
  const id = randomBytes(16).toString("hex");

  const user: UserDocument = {
    id,
    name: input.name,
    role: input.role ?? "enthusiast",
    workplaces: input.workplaces ?? [],
    workplaceLocations: input.workplaceLocations ?? [],
    specialties: input.specialties ?? [],
    socials: defaultSocials,
    socialAccounts: input.socialAccount ? [input.socialAccount] : [],
    createdAt: now,
    updatedAt: now,
  };

  if (input.email) user.email = input.email;
  if (input.phone) user.phone = input.phone;
  if (input.passwordHash) user.passwordHash = input.passwordHash;
  if (input.avatarUrl) user.avatarUrl = input.avatarUrl;
  if (input.termsAcceptance) Object.assign(user, input.termsAcceptance);

  return user;
}
