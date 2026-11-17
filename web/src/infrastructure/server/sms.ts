import { SolapiMessageService } from "solapi";

export async function sendVerificationSMS(
  phone: string,
  code: string,
): Promise<boolean> {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const sender = process.env.SOLAPI_SENDER;

  if (!apiKey || !apiSecret || !sender) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Solapi credentials are not configured.");
    }

    console.info("[DEV] SMS not sent. Solapi env vars are missing.", {
      phone,
      code,
    });
    return false;
  }

  const service = new SolapiMessageService(apiKey, apiSecret);

  await service.send({
    to: phone.replace(/\D/g, ""),
    from: sender,
    text: `[블렌딩] 인증번호는 ${code}입니다. 5분 이내에 입력해주세요.`,
  });

  return true;
}
