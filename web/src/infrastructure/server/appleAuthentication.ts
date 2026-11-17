import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const APPLE_ISSUER = "https://appleid.apple.com";
const appleJwks = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);

type AppleTokenPayload = JWTPayload & {
  email?: unknown;
  nonce?: unknown;
};

export type VerifiedAppleIdentity = {
  sub: string;
  email?: string;
};

type VerifyAppleJwt = (
  identityToken: string,
  audience: string,
) => Promise<AppleTokenPayload>;

const verifyAppleJwt: VerifyAppleJwt = async (identityToken, audience) => {
  const { payload } = await jwtVerify(identityToken, appleJwks, {
    algorithms: ["RS256"],
    audience,
    issuer: APPLE_ISSUER,
    requiredClaims: ["sub", "exp", "iat"],
  });
  return payload;
};

export async function verifyAppleIdentityToken(
  identityToken: string,
  audience: string,
  nonce: string,
  verify: VerifyAppleJwt = verifyAppleJwt,
): Promise<VerifiedAppleIdentity> {
  const payload = await verify(identityToken, audience);
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("Apple identity token subject가 없습니다.");
  }
  if (payload.nonce !== nonce) {
    throw new Error("Apple identity token nonce가 일치하지 않습니다.");
  }

  return {
    sub: payload.sub,
    ...(typeof payload.email === "string" ? { email: payload.email } : {}),
  };
}
