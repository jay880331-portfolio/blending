import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { AdminSession } from "@blending/admin-contracts";
import { ADMIN_SESSION_COOKIE } from "@blending/admin-contracts";
import type { NextRequest, NextResponse } from "next/server";
import { usersCollection } from "@/infrastructure/server/auth";
import { hasAdminRole } from "@/infrastructure/server/authRole";
import { activeAccountFilter } from "@/infrastructure/server/accountStatus";
import { isLoginAllowed } from "@/infrastructure/server/sanctions";

const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

type AdminSessionPayload = {
  aud: "admin";
  sub: string;
  csrfToken: string;
  iat: number;
  exp: number;
};

function getAdminAuthSecret() {
  const secret = process.env.ADMIN_AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production")
    throw new Error("ADMIN_AUTH_SECRET environment variable is required.");
  return "blending-admin-development-secret";
}

function signValue(value: string) {
  return createHmac("sha256", getAdminAuthSecret())
    .update(value)
    .digest("base64url");
}

export function signAdminSession(userId: string) {
  const now = Math.floor(Date.now() / 1_000);
  const csrfToken = randomBytes(32).toString("base64url");
  const token = signAdminPayload({
    aud: "admin",
    sub: userId,
    csrfToken,
    iat: now,
    exp: now + ADMIN_SESSION_MAX_AGE,
  });
  return { token, csrfToken };
}

function signAdminPayload(payload: AdminSessionPayload) {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const unsigned = `${header}.${encodedPayload}`;
  return `${unsigned}.${signValue(unsigned)}`;
}

export function verifyAdminSession(token: string): AdminSession | null {
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
    ) as Partial<AdminSessionPayload>;
    const now = Math.floor(Date.now() / 1_000);
    if (
      parsed.aud !== "admin" ||
      typeof parsed.sub !== "string" ||
      parsed.sub.length === 0 ||
      typeof parsed.csrfToken !== "string" ||
      parsed.csrfToken.length === 0 ||
      typeof parsed.iat !== "number" ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= now ||
      parsed.exp - parsed.iat !== ADMIN_SESSION_MAX_AGE
    )
      return null;
    return { userId: parsed.sub, csrfToken: parsed.csrfToken };
  } catch {
    return null;
  }
}

export function readAdminSession(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  return token ? verifyAdminSession(token) : null;
}

export async function getCurrentAdminSessionUser(request: NextRequest) {
  const session = readAdminSession(request);
  if (!session) return null;

  const users = await usersCollection();
  const user = await users.findOne({
    id: session.userId,
    ...activeAccountFilter(),
  });
  if (!user || !hasAdminRole(user)) return null;
  return (await isLoginAllowed(user.id)) ? user : null;
}

export function setAdminSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: "/api/admin",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/api/admin",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}
