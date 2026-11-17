import type {
  AdminLoginRequest,
  AdminSessionResponse,
} from "@blending/admin-contracts";
import type { WithId } from "mongodb";
import type { NextRequest } from "next/server";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import {
  comparePassword,
  type UserDocument,
  usersCollection,
} from "@/infrastructure/server/auth";
import { hasAdminRole } from "@/infrastructure/server/authRole";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminRequestId,
  forbiddenAdminRequest,
  isAllowedAdminOrigin,
} from "@/infrastructure/server/adminRequest";
import {
  adminClientIp,
  adminLoginRateLimiter,
  deriveAdminLoginKey,
} from "@/infrastructure/server/adminRateLimit";
import {
  setAdminSessionCookie,
  signAdminSession,
} from "@/infrastructure/server/adminSession";
import { readJson, requireString } from "@/infrastructure/server/http";
import { activeAccountFilter } from "@/infrastructure/server/accountStatus";
import { isLoginAllowed } from "@/infrastructure/server/sanctions";

const INVALID_CREDENTIALS = "전화번호 또는 비밀번호가 올바르지 않습니다.";

type LoginUser = WithId<UserDocument> & { deletedAt?: Date | string | null };

export async function POST(request: NextRequest) {
  if (!isAllowedAdminOrigin(request)) return forbiddenAdminRequest(request);

  const requestId = adminRequestId(request);
  const body = await readJson<AdminLoginRequest>(request);
  const phone = requireString(body.phone)?.replace(/\D/g, "");
  const password =
    typeof body.password === "string" && body.password.length > 0
      ? body.password
      : null;
  if (!phone || !password) {
    return adminError(
      "INVALID_INPUT",
      "전화번호와 비밀번호를 입력해주세요.",
      400,
      requestId,
    );
  }

  await ensureMongoIndexes();
  const loginKey = deriveAdminLoginKey(adminClientIp(request), phone);
  if (await adminLoginRateLimiter.isBlocked(loginKey)) {
    return adminError(
      "RATE_LIMITED",
      "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.",
      429,
      requestId,
    );
  }

  const users = await usersCollection();
  const user = (await users.findOne({
    phone,
    ...activeAccountFilter(),
  })) as LoginUser | null;
  if (
    !user?.passwordHash ||
    user.deletedAt != null ||
    !(await comparePassword(password, user.passwordHash))
  ) {
    await adminLoginRateLimiter.recordFailure(loginKey);
    return adminError("UNAUTHENTICATED", INVALID_CREDENTIALS, 401, requestId);
  }
  if (!(await isLoginAllowed(user.id)))
    return adminError("FORBIDDEN", "제재 중인 계정입니다.", 403, requestId);

  await adminLoginRateLimiter.clear(loginKey);
  if (!hasAdminRole(user)) {
    return adminError(
      "FORBIDDEN",
      "관리자 계정만 로그인할 수 있습니다.",
      403,
      requestId,
    );
  }

  const { token, csrfToken } = signAdminSession(user.id);
  const response = adminJson<AdminSessionResponse>({
    authenticated: true,
    user: { id: user.id, name: user.name, role: "admin" },
    csrfToken,
  });
  setAdminSessionCookie(response, token);
  return response;
}
