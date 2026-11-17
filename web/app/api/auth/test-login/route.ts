import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import {
  attachUserSession,
  createUserDocument,
  hashPassword,
  requiresTermsConsent,
  usersCollection,
} from "@/infrastructure/server/auth";
import { isActiveAccount } from "@/infrastructure/server/accountStatus";
import { isLoginAllowed } from "@/infrastructure/server/sanctions";

const TEST_PHONE = "01000000000";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { message: "테스트 로그인은 개발 환경에서만 사용할 수 있습니다." },
      { status: 404 },
    );
  }

  await ensureMongoIndexes();
  const users = await usersCollection();
  const existingUser = await users.findOne({ phone: TEST_PHONE });
  if (existingUser && !isActiveAccount(existingUser)) {
    return NextResponse.json(
      { message: "비활성화된 계정입니다." },
      { status: 403 },
    );
  }
  const user =
    existingUser ??
    createUserDocument({
      phone: TEST_PHONE,
      passwordHash: await hashPassword("test1234"),
      name: "홍길동",
      role: "enthusiast",
      avatarUrl: "https://ssl.pstatic.net/static/pwe/address/img_profile.png",
    });

  if (!existingUser) await users.insertOne(user);
  if (!(await isLoginAllowed(user.id)))
    return NextResponse.json(
      { message: "제재 중인 계정입니다." },
      { status: 403 },
    );

  const response = NextResponse.json({
    method: "phone",
    success: true,
    user: { id: user.id, name: user.name },
    nextPath: requiresTermsConsent(user) ? "/login/consent" : "/home",
  });
  await attachUserSession(request, response, user, "phone");
  return response;
}
