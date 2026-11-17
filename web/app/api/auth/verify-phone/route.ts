import { NextResponse } from "next/server";
import {
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";
import { requestPhoneVerification } from "@/infrastructure/server/phoneVerification";

type VerifyPhoneRequest = {
  phone: string;
};

export async function POST(request: Request) {
  const body = await readJson<VerifyPhoneRequest>(request);
  const phone = requireString(body.phone);

  if (!phone || phone.replace(/\D/g, "").length < 10)
    return jsonError("올바른 전화번호를 입력해주세요.");

  try {
    const result = await requestPhoneVerification(phone);
    return NextResponse.json({
      success: true,
      message: result.sent
        ? "인증번호가 발송됐습니다."
        : `인증번호가 발송됐습니다. (개발모드: ${result.code})`,
      code: result.code,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "SMS 발송 중 오류가 발생했습니다.",
      500,
    );
  }
}
