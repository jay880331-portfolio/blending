import { NextResponse, type NextRequest } from "next/server";
import { validatePasswordResetDraft } from "@/domain/member/passwordResetValidation";
import { hashPassword, usersCollection } from "@/infrastructure/server/auth";
import {
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";
import { consumePhoneVerification } from "@/infrastructure/server/phoneVerification";
import { activeAccountFilter } from "@/infrastructure/server/accountStatus";
import { isLoginAllowed } from "@/infrastructure/server/sanctions";
import { getMongoClient, getMongoDb } from "@/infrastructure/mongodb/client";

type PasswordResetRequest = {
  phone: string;
  phoneVerificationToken: string;
  newPassword: string;
};

export async function PATCH(request: NextRequest) {
  const body = await readJson<PasswordResetRequest>(request);
  const phone = (requireString(body.phone) ?? "").replace(/\D/g, "");
  const phoneVerificationToken =
    requireString(body.phoneVerificationToken) ?? "";
  const newPassword = requireString(body.newPassword) ?? "";

  const validationMessage = validatePasswordResetDraft({
    verificationToken: phoneVerificationToken,
    password: newPassword,
    passwordConfirm: newPassword,
  });
  if (!phone || phone.length < 10)
    return jsonError("휴대폰 번호를 입력해주세요.");
  if (validationMessage) return jsonError(validationMessage);

  const users = await usersCollection();
  const user = await users.findOne({ phone, ...activeAccountFilter() });
  if (user && !(await isLoginAllowed(user.id)))
    return jsonError("제재 중인 계정입니다.", 403);
  if (!user) return jsonError("가입된 계정을 찾을 수 없습니다.", 404);

  const session = (await getMongoClient()).startSession();
  let changed = false;
  let verificationExpired = false;
  try {
    await session.withTransaction(async () => {
      if (
        !(await consumePhoneVerification(
          phone,
          phoneVerificationToken,
          session,
        ))
      ) {
        verificationExpired = true;
        return;
      }
      changed =
        (
          await (await getMongoDb()).collection("users").updateOne(
            { id: user.id, phone, ...activeAccountFilter() },
            {
              $set: {
                passwordHash: await hashPassword(newPassword),
                updatedAt: new Date(),
              },
            },
            { session },
          )
        ).matchedCount === 1;
      if (!changed) throw new Error("inactive_account");
    });
  } catch {
    return jsonError("비밀번호를 변경할 수 없습니다.", 409);
  } finally {
    await session.endSession();
  }
  if (verificationExpired) return jsonError("휴대폰 인증이 만료됐습니다.");

  return NextResponse.json({ success: true });
}
