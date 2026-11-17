import { NextResponse, type NextRequest } from "next/server";
import {
  comparePassword,
  getCurrentUser,
  hashPassword,
  usersCollection,
} from "@/infrastructure/server/auth";
import {
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";
import { activeAccountFilter } from "@/infrastructure/server/accountStatus";

type PasswordChangeRequest = {
  currentPassword: string;
  newPassword: string;
};

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  if (!user.passwordHash)
    return jsonError(
      "비밀번호 로그인이 설정된 계정만 변경할 수 있습니다.",
      400,
    );

  const body = await readJson<PasswordChangeRequest>(request);
  const currentPassword = requireString(body.currentPassword);
  const newPassword = requireString(body.newPassword);

  if (!currentPassword || !newPassword)
    return jsonError("현재 비밀번호와 새 비밀번호를 입력해주세요.");
  if (newPassword.length < 8)
    return jsonError("새 비밀번호는 8자리 이상이어야 합니다.");
  if (!(await comparePassword(currentPassword, user.passwordHash)))
    return jsonError("현재 비밀번호가 올바르지 않습니다.", 401);

  const users = await usersCollection();
  const result = await users.updateOne(
    { id: user.id, ...activeAccountFilter() },
    {
      $set: {
        passwordHash: await hashPassword(newPassword),
        updatedAt: new Date(),
      },
    },
  );
  if (result.matchedCount !== 1)
    return jsonError("계정 정보를 변경할 수 없습니다.", 409);

  return NextResponse.json({ success: true });
}
