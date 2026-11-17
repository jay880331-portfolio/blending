import { randomBytes } from "node:crypto";
import type { ClientSession, Collection } from "mongodb";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { sendVerificationSMS } from "@/infrastructure/server/sms";

export const FAKE_PHONE = "00000000000";
export const FAKE_CODE = "000000";
export const FAKE_TOKEN = "fake-verification-token-dev";

type PhoneVerificationDocument = {
  phone: string;
  code: string;
  token?: string;
  isVerified: boolean;
  expiresAt: Date;
  createdAt: Date;
};

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

async function verificationsCollection(): Promise<
  Collection<PhoneVerificationDocument>
> {
  await ensureMongoIndexes();
  const db = await getMongoDb();
  return db.collection<PhoneVerificationDocument>("phone_verifications");
}

export async function requestPhoneVerification(rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  if (phone.length < 10) throw new Error("전화번호를 입력해주세요.");

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const verifications = await verificationsCollection();

  await verifications.deleteMany({ phone });
  await verifications.insertOne({
    phone,
    code,
    isVerified: false,
    expiresAt,
    createdAt: new Date(),
  });

  const sent = await sendVerificationSMS(phone, code);
  return {
    sent,
    code: process.env.NODE_ENV === "production" && sent ? undefined : code,
  };
}

export async function confirmPhoneVerification(rawPhone: string, code: string) {
  const phone = normalizePhone(rawPhone);

  if (
    process.env.NODE_ENV !== "production" &&
    phone === FAKE_PHONE &&
    code === FAKE_CODE
  ) {
    return FAKE_TOKEN;
  }

  const verifications = await verificationsCollection();
  const verification = await verifications.findOne({
    phone,
    code,
    isVerified: false,
    expiresAt: { $gt: new Date() },
  });

  if (!verification)
    throw new Error("인증 코드가 올바르지 않거나 만료됐습니다.");

  const token = randomBytes(32).toString("hex");
  await verifications.updateOne(
    { _id: verification._id },
    { $set: { token, isVerified: true } },
  );
  return token;
}

export async function consumePhoneVerification(
  rawPhone: string,
  token: string,
  session?: ClientSession,
) {
  const phone = normalizePhone(rawPhone);

  if (
    process.env.NODE_ENV !== "production" &&
    phone === FAKE_PHONE &&
    token === FAKE_TOKEN
  )
    return true;

  const verifications = await verificationsCollection();
  const filter = {
    phone,
    token,
    isVerified: true,
    expiresAt: { $gt: new Date() },
  };
  const result = session
    ? await verifications.findOneAndDelete(filter, { session })
    : await verifications.findOneAndDelete(filter);

  return Boolean(result);
}

export async function verifyPhoneVerification(rawPhone: string, token: string) {
  const phone = normalizePhone(rawPhone);

  if (
    process.env.NODE_ENV !== "production" &&
    phone === FAKE_PHONE &&
    token === FAKE_TOKEN
  )
    return true;

  const verifications = await verificationsCollection();
  const verification = await verifications.findOne({
    phone,
    token,
    isVerified: true,
    expiresAt: { $gt: new Date() },
  });

  return Boolean(verification);
}
