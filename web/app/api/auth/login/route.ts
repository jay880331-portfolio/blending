import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import {
  attachUserSession,
  comparePassword,
  requiresTermsConsent,
  usersCollection,
} from "@/infrastructure/server/auth";
import {
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";
import { activeAccountFilter } from "@/infrastructure/server/accountStatus";
import { isLoginAllowed } from "@/infrastructure/server/sanctions";

type LoginRequest = {
  phone: string;
  password: string;
};

export async function POST(request: NextRequest) {
  const body = await readJson<LoginRequest>(request);
  const phone = requireString(body.phone);
  const password = requireString(body.password);

  if (!phone || !password)
    return jsonError("전화번호와 비밀번호를 입력해주세요.");

  await ensureMongoIndexes();

  const users = await usersCollection();
  const user = await users.findOne({
    phone: phone.replace(/\D/g, ""),
    ...activeAccountFilter(),
  });

  if (
    !user?.passwordHash ||
    !(await comparePassword(password, user.passwordHash))
  ) {
    return jsonError("전화번호 또는 비밀번호가 올바르지 않습니다.", 401);
  }
  if (!(await isLoginAllowed(user.id)))
    return jsonError("제재 중인 계정입니다.", 403);

  const response = NextResponse.json({
    success: true,
    method: "phone",
    user: { id: user.id, name: user.name },
    nextPath: requiresTermsConsent(user) ? "/login/consent" : "/home",
  });
  await attachUserSession(request, response, user, "phone");
  return response;
}
