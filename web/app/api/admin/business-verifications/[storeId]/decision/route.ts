import { NextResponse, type NextRequest } from "next/server";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminAuditInput,
  adminRequestId,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";
import {
  BusinessVerificationConflictError,
  BusinessVerificationNotFoundError,
  BusinessVerificationValidationError,
  decideStoreBusinessVerification,
  parseBusinessVerificationDecisionInput,
} from "@/infrastructure/server/businessVerificationDecision";
import { readJson } from "@/infrastructure/server/http";
import { schedulePushNotificationIfEnabled } from "@/infrastructure/server/pushNotifications";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ storeId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;

  const { storeId } = await params;
  try {
    const input = parseBusinessVerificationDecisionInput(
      await readJson(request),
    );
    await ensureMongoIndexes();
    const result = await runAuditedMutation(
      adminUnitOfWork,
      adminAuditMongoRepository,
      adminAuditInput(request, auth.admin, {
        action: "store.business_verification.decide",
        resourceType: "barista_showroom",
        resourceId: storeId,
        changedFields:
          input.decision === "approve"
            ? ["businessVerification.status", "businessVerification.reviewedAt"]
            : [
                "businessVerification.status",
                "businessVerification.reviewedAt",
                "businessVerification.rejectReason",
              ],
        reason: input.reason ?? "사업자 인증 승인",
      }),
      (session) =>
        decideStoreBusinessVerification(
          { storeId, adminId: auth.admin.id, input },
          { session },
        ),
    );

    schedulePushNotificationIfEnabled(result.ownerId, "eventUpdates", {
      title:
        input.decision === "approve"
          ? "매장 사업자 인증 완료"
          : "매장 사업자 인증 반려",
      body: result.notifTitle,
      data: { href: "/showroom/manage" },
    });

    return adminJson({
      storeId: result.storeId,
      status: result.status,
      reviewedAt: result.reviewedAt,
      reviewedBy: result.reviewedBy,
      ...(result.rejectReason ? { rejectReason: result.rejectReason } : {}),
    });
  } catch (error) {
    if (error instanceof BusinessVerificationValidationError) {
      return adminError(
        "INVALID_INPUT",
        error.message,
        400,
        adminRequestId(request),
      );
    }
    if (error instanceof BusinessVerificationNotFoundError) {
      return adminError(
        "NOT_FOUND",
        error.message,
        404,
        adminRequestId(request),
      );
    }
    if (error instanceof BusinessVerificationConflictError) {
      return adminError(
        "CONFLICT",
        error.message,
        409,
        adminRequestId(request),
      );
    }
    return adminError(
      "INTERNAL_ERROR",
      "사업자 인증 요청을 처리하지 못했습니다.",
      500,
      adminRequestId(request),
    );
  }
}
