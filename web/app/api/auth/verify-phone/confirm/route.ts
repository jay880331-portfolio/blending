import { NextResponse } from "next/server";
import {
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";
import { confirmPhoneVerification } from "@/infrastructure/server/phoneVerification";

type ConfirmPhoneRequest = {
  phone: string;
  code: string;
};

export async function POST(request: Request) {
  const body = await readJson<ConfirmPhoneRequest>(request);
  const phone = requireString(body.phone);
  const code = requireString(body.code);

  if (!phone || !code) return jsonError("전화번호와 인증 코드를 입력해주세요.");

  try {
    const verificationToken = await confirmPhoneVerification(phone, code);
    return NextResponse.json({ success: true, verificationToken });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "인증 코드 확인에 실패했습니다.",
    );
  }
}
