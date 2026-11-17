import { NextResponse, type NextRequest } from "next/server";
import {
  normalizeAccountEmail,
  normalizeAccountPhone,
  validateAccountEmail,
  validateAccountPhone,
} from "@/domain/member/accountValidation";
import { getCurrentUser, usersCollection } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import { consumePhoneVerification } from "@/infrastructure/server/phoneVerification";
import { activeAccountFilter } from "@/infrastructure/server/accountStatus";
import { getMongoClient, getMongoDb } from "@/infrastructure/mongodb/client";

export { deleteMemberAccountRoute as DELETE } from "@/infrastructure/server/memberAccountDeletionRoute";

type AccountPatchRequest = {
  email?: string;
  phone?: string;
  phoneVerificationToken?: string;
};

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const body = await readJson<AccountPatchRequest>(request);
  if (typeof body.email === "string") return updateAccountEmail(user.id, body);
  if (
    typeof body.phone === "string" ||
    typeof body.phoneVerificationToken === "string"
  )
    return updateAccountPhone(user.id, body);

  return jsonError("변경할 계정 정보를 입력해주세요.");
}

async function updateAccountEmail(userId: string, body: AccountPatchRequest) {
  const email = normalizeAccountEmail(body.email ?? "");
  const error = validateAccountEmail(email);
  if (error) return jsonError(error);

  const users = await usersCollection();
  const duplicate = await users.findOne({ email, id: { $ne: userId } });
  if (duplicate) return jsonError("이미 등록된 이메일입니다.");

  const result = await users.updateOne(
    { id: userId, ...activeAccountFilter() },
    {
      $set: {
        email,
        updatedAt: new Date(),
      },
    },
  );
  if (result.matchedCount !== 1)
    return jsonError("계정 정보를 변경할 수 없습니다.", 409);

  return NextResponse.json({ success: true, email });
}

async function updateAccountPhone(userId: string, body: AccountPatchRequest) {
  const phone = normalizeAccountPhone(body.phone ?? "");
  const error = validateAccountPhone(phone);
  if (error) return jsonError(error);
  if (!body.phoneVerificationToken)
    return jsonError("휴대폰 인증이 필요합니다.");

  const session = (await getMongoClient()).startSession();
  let changed = false;
  let verificationExpired = false;
  try {
    await session.withTransaction(async () => {
      const users = (await getMongoDb()).collection("users");
      if (await users.findOne({ phone, id: { $ne: userId } }, { session }))
        throw new Error("duplicate_phone");
      if (
        !(await consumePhoneVerification(
          phone,
          body.phoneVerificationToken!,
          session,
        ))
      ) {
        verificationExpired = true;
        return;
      }
      changed =
        (
          await users.updateOne(
            { id: userId, ...activeAccountFilter() },
            { $set: { phone, updatedAt: new Date() } },
            { session },
          )
        ).matchedCount === 1;
      if (!changed) throw new Error("inactive_account");
    });
  } catch (error) {
    if (error instanceof Error && error.message === "duplicate_phone")
      return jsonError("이미 등록된 휴대폰 번호입니다.");
    return jsonError("계정 정보를 변경할 수 없습니다.", 409);
  } finally {
    await session.endSession();
  }
  if (verificationExpired)
    return jsonError("휴대폰 인증이 만료됐습니다. 다시 인증해주세요.");

  return NextResponse.json({ success: true, phone });
}
