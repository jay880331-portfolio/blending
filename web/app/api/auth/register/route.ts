import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMongoClient, getMongoDb } from "@/infrastructure/mongodb/client";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import type { MemberProfile } from "@/domain/member/types";
import { profileFromUser } from "@/infrastructure/mongodb/memberMongoRepository";
import { syncProfileSearchDocument } from "@/infrastructure/mongodb/searchMongoRepository";
import {
  attachUserSession,
  createUserDocument,
  hashPassword,
} from "@/infrastructure/server/auth";
import {
  compactStrings,
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";
import {
  FAKE_PHONE,
  FAKE_TOKEN,
  verifyPhoneVerification,
} from "@/infrastructure/server/phoneVerification";
import type {
  PublicMemberRole,
  WorkplaceLocation,
} from "@/domain/member/types";
import { operationGuardResponse } from "@/infrastructure/server/operationPolicy";
import {
  currentTermsAcceptance,
  hasCurrentTermsAgreement,
  termsConsentRequiredResponse,
} from "@/infrastructure/server/terms";

type RegisterRequest = {
  phone: string;
  password: string;
  name: string;
  phoneVerificationToken: string;
  role?: PublicMemberRole;
  workplaces?: string[];
  workplaceLocations?: WorkplaceLocation[];
  termsAccepted: boolean;
};

export async function POST(request: NextRequest) {
  const blocked = await operationGuardResponse("signupEnabled");
  if (blocked) return blocked;
  const body = await readJson<RegisterRequest>(request);
  const phone = requireString(body.phone);
  const password = requireString(body.password);
  const name = requireString(body.name);
  const phoneVerificationToken = requireString(body.phoneVerificationToken);

  if (!hasCurrentTermsAgreement(body.termsAccepted))
    return termsConsentRequiredResponse();

  if (!phone || !password || !name || !phoneVerificationToken)
    return jsonError("필수 항목을 모두 입력해주세요.");
  if (password.length < 8)
    return jsonError("비밀번호는 8자리 이상이어야 합니다.");

  await ensureMongoIndexes();

  const normalizedPhone = phone.replace(/\D/g, "");
  const client = await getMongoClient();
  const db = await getMongoDb();
  const users = db.collection("users");
  const existingUser = await users.findOne({ phone: normalizedPhone });
  if (existingUser) return jsonError("이미 가입된 휴대폰 번호입니다.");

  const verified = await verifyPhoneVerification(
    normalizedPhone,
    phoneVerificationToken,
  );
  if (!verified) return jsonError("전화번호 인증이 완료되지 않았습니다.");

  const user = createUserDocument({
    phone: normalizedPhone,
    passwordHash: await hashPassword(password),
    name,
    role: isPublicMemberRole(body.role) ? body.role : "enthusiast",
    workplaces: compactStrings(body.workplaces),
    workplaceLocations: isWorkplaceLocations(body.workplaceLocations)
      ? body.workplaceLocations
      : [],
    termsAcceptance: currentTermsAcceptance(),
  });
  const session = client.startSession();

  try {
    await session.withTransaction(async () => {
      const duplicated = await users.findOne(
        { phone: normalizedPhone },
        { session },
      );
      if (duplicated) throw new DuplicatePhoneError();

      await users.insertOne(user, { session });
      await db
        .collection("member_profiles")
        .updateOne(
          { ownerId: user.id },
          { $setOnInsert: profileFromUser(user) },
          { upsert: true, session },
        );
      const profile = await db
        .collection<MemberProfile & { ownerId?: string }>("member_profiles")
        .findOne({ ownerId: user.id }, { session });
      if (profile) await syncProfileSearchDocument(profile, session);

      if (!isFakePhoneVerification(normalizedPhone, phoneVerificationToken)) {
        const consumed = await db
          .collection("phone_verifications")
          .findOneAndDelete(
            {
              phone: normalizedPhone,
              token: phoneVerificationToken,
              isVerified: true,
              expiresAt: { $gt: new Date() },
            },
            { session },
          );
        if (!consumed) throw new PhoneVerificationError();
      }
    });
  } catch (error) {
    if (error instanceof PhoneVerificationError)
      return jsonError("전화번호 인증이 완료되지 않았습니다.");
    if (error instanceof DuplicatePhoneError || isDuplicateKey(error))
      return jsonError("이미 가입된 휴대폰 번호입니다.");

    throw error;
  } finally {
    await session.endSession();
  }

  const response = NextResponse.json(
    {
      success: true,
      method: "phone",
      user: { id: user.id, name: user.name },
    },
    { status: 201 },
  );
  await attachUserSession(request, response, user, "phone");
  return response;
}

class DuplicatePhoneError extends Error {}

class PhoneVerificationError extends Error {}

function isFakePhoneVerification(phone: string, token: string) {
  return (
    process.env.NODE_ENV !== "production" &&
    phone === FAKE_PHONE &&
    token === FAKE_TOKEN
  );
}

function isDuplicateKey(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

function isPublicMemberRole(value: unknown): value is PublicMemberRole {
  return value === "barista" || value === "enthusiast" || value === "partner";
}

function isWorkplaceLocations(value: unknown): value is WorkplaceLocation[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const location = item as Partial<WorkplaceLocation>;
    return (
      typeof location.id === "string" &&
      typeof location.name === "string" &&
      typeof location.address === "string" &&
      isOptionalString(location.postalCode) &&
      isOptionalString(location.detailAddress) &&
      (typeof location.employmentTypes === "undefined" ||
        isStringArray(location.employmentTypes)) &&
      typeof location.displayName === "string" &&
      typeof location.lat === "number" &&
      typeof location.lng === "number" &&
      Number.isFinite(location.lat) &&
      Number.isFinite(location.lng)
    );
  });
}

function isOptionalString(value: unknown) {
  return typeof value === "undefined" || typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}
