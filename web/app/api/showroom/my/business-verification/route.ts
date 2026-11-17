import { type NextRequest, NextResponse } from "next/server";
import { canWriteShowroom } from "@/domain/showroom/access";
import {
  formatBusinessNumber,
  isValidBusinessNumber,
  normalizeBusinessNumber,
  type BusinessVerification,
} from "@/domain/showroom/businessNumber";
import type { BaristaShowroom } from "@/domain/showroom/types";
import { getMongoDb, toDomain } from "@/infrastructure/mongodb/client";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { nowIso } from "@/infrastructure/server/content";
import { jsonError, readJson } from "@/infrastructure/server/http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  if (!canWriteShowroom(user.role)) {
    return jsonError("바리스타 계정만 사업자 인증을 신청할 수 있습니다.", 403);
  }

  const body = await readJson<{ businessNumber?: unknown }>(request);
  const raw =
    typeof body?.businessNumber === "string" ? body.businessNumber : "";
  const digits = normalizeBusinessNumber(raw);
  if (!digits || !isValidBusinessNumber(digits)) {
    return jsonError("유효한 10자리 사업자등록번호를 입력해주세요.", 400);
  }

  const db = await getMongoDb();
  const existing = await db
    .collection<BaristaShowroom>("barista_showrooms")
    .findOne({ userId: user.id });

  if (!existing) {
    return jsonError("먼저 쇼룸 기본 정보를 등록해주세요.", 404);
  }

  if (
    existing.businessVerification?.status === "VERIFIED" &&
    existing.businessVerification.number === digits
  ) {
    const showroom = toDomain(existing);
    return NextResponse.json({
      showroom: {
        ...showroom,
        businessVerified: true,
      },
      formattedNumber: formatBusinessNumber(digits),
    });
  }

  const submittedAt = nowIso();
  const nextVerification: BusinessVerification = {
    number: digits,
    status: "PENDING",
    submittedAt,
  };

  const updated = await db
    .collection<BaristaShowroom>("barista_showrooms")
    .findOneAndUpdate(
      { userId: user.id },
      {
        $set: {
          businessVerification: nextVerification,
          updatedAt: submittedAt,
        },
      },
      { returnDocument: "after" },
    );

  if (!updated) {
    return jsonError("먼저 쇼룸 기본 정보를 등록해주세요.", 404);
  }

  const showroom = toDomain(updated);
  return NextResponse.json({
    showroom: {
      ...showroom,
      businessVerified: false,
    },
    formattedNumber: formatBusinessNumber(digits),
  });
}
