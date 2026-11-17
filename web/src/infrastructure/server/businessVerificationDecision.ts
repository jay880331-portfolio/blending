import type { ClientSession, Db } from "mongodb";
import type { AdminBusinessVerificationDecisionRequest } from "@blending/admin-contracts";
import {
  BUSINESS_REJECT_REASON_MAX_LENGTH,
  normalizeBusinessNumber,
} from "@/domain/showroom/businessNumber";
import type { BaristaShowroom } from "@/domain/showroom/types";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { createId, nowIso } from "@/infrastructure/server/content";

export class BusinessVerificationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessVerificationValidationError";
  }
}

export class BusinessVerificationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessVerificationNotFoundError";
  }
}

export class BusinessVerificationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessVerificationConflictError";
  }
}

export type ParsedBusinessVerificationDecision = {
  decision: "approve" | "reject";
  number: string;
  submittedAt?: string;
  reason?: string;
};

export function parseBusinessVerificationDecisionInput(
  raw: unknown,
): ParsedBusinessVerificationDecision {
  if (!raw || typeof raw !== "object") {
    throw new BusinessVerificationValidationError(
      "요청 본문이 올바르지 않습니다.",
    );
  }
  const body = raw as Partial<AdminBusinessVerificationDecisionRequest>;
  if (body.decision !== "approve" && body.decision !== "reject") {
    throw new BusinessVerificationValidationError(
      "approve 또는 reject를 선택해주세요.",
    );
  }
  const digits =
    typeof body.number === "string"
      ? normalizeBusinessNumber(body.number)
      : null;
  if (!digits) {
    throw new BusinessVerificationValidationError(
      "검증할 10자리 사업자등록번호가 필요합니다.",
    );
  }
  const submittedAt =
    typeof body.submittedAt === "string" && body.submittedAt.trim()
      ? body.submittedAt.trim()
      : undefined;
  const trimmedReason =
    typeof body.reason === "string" ? body.reason.trim() : "";

  if (body.decision === "reject") {
    if (
      !trimmedReason ||
      [...trimmedReason].length > BUSINESS_REJECT_REASON_MAX_LENGTH
    ) {
      throw new BusinessVerificationValidationError(
        `반려 사유를 1~${BUSINESS_REJECT_REASON_MAX_LENGTH}자로 입력해주세요.`,
      );
    }
  }

  return {
    decision: body.decision,
    number: digits,
    ...(submittedAt ? { submittedAt } : {}),
    ...(trimmedReason ? { reason: trimmedReason } : {}),
  };
}

export async function decideStoreBusinessVerification(
  {
    storeId,
    adminId,
    input,
  }: {
    storeId: string;
    adminId: string;
    input: ParsedBusinessVerificationDecision;
  },
  { db, session }: { db?: Db; session?: ClientSession } = {},
) {
  const resolvedDb = db ?? (await getMongoDb());
  const reviewedAt = nowIso();
  const nextStatus = input.decision === "approve" ? "VERIFIED" : "REJECTED";

  const filter: Record<string, unknown> = {
    id: storeId,
    "businessVerification.status": "PENDING",
    "businessVerification.number": input.number,
  };
  if (input.submittedAt) {
    filter["businessVerification.submittedAt"] = input.submittedAt;
  }

  const updateDoc =
    input.decision === "approve"
      ? {
          $set: {
            "businessVerification.status": nextStatus,
            "businessVerification.reviewedAt": reviewedAt,
            "businessVerification.reviewedBy": adminId,
            updatedAt: reviewedAt,
          },
          $unset: {
            "businessVerification.rejectReason": "" as const,
          },
        }
      : {
          $set: {
            "businessVerification.status": nextStatus,
            "businessVerification.reviewedAt": reviewedAt,
            "businessVerification.reviewedBy": adminId,
            "businessVerification.rejectReason": input.reason!,
            updatedAt: reviewedAt,
          },
        };

  const updated = await resolvedDb
    .collection<BaristaShowroom>("barista_showrooms")
    .findOneAndUpdate(filter, updateDoc, { session, returnDocument: "after" });

  if (!updated) {
    const existing = await resolvedDb
      .collection<BaristaShowroom>("barista_showrooms")
      .findOne({ id: storeId }, { session, projection: { id: 1 } });
    if (!existing) {
      throw new BusinessVerificationNotFoundError(
        "사업자 인증 신청 매장을 찾을 수 없습니다.",
      );
    }
    throw new BusinessVerificationConflictError(
      "사업자 인증 상태 또는 신청 번호가 변경되었습니다. 새로고침 후 다시 확인해주세요.",
    );
  }

  const notifTitle =
    input.decision === "approve"
      ? `[사업자 인증 완료] ${updated.storeName}의 커피 여권·원두 예약 기능이 열렸습니다.`
      : `[사업자 인증 반려] ${updated.storeName}: ${input.reason}`;

  await resolvedDb.collection("member_notifications").insertOne(
    {
      id: createId("notif"),
      ownerId: updated.userId,
      kind: "notice",
      title: notifTitle,
      createdAgo: "방금 전",
      createdAt: reviewedAt,
      unread: true,
      href: "/showroom/manage",
    },
    { session },
  );

  return {
    storeId: updated.id,
    ownerId: updated.userId,
    notifTitle,
    status: nextStatus,
    reviewedAt,
    reviewedBy: adminId,
    ...(input.decision === "reject" ? { rejectReason: input.reason } : {}),
  };
}
