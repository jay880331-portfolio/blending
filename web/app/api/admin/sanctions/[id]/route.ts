import { NextResponse, type NextRequest } from "next/server";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import { AdminModerationMongoRepository } from "@/infrastructure/mongodb/adminModerationMongoRepository";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminAuditInput,
  adminRequestId,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";
import { readJson } from "@/infrastructure/server/http";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  const id = (await params).id,
    reason = (await readJson<{ reason?: string }>(request)).reason?.trim();
  if (!reason)
    return adminError(
      "INVALID_INPUT",
      "해제 사유를 입력해주세요.",
      400,
      adminRequestId(request),
    );
  const result = await runAuditedMutation(
    adminUnitOfWork,
    adminAuditMongoRepository,
    adminAuditInput(request, auth.admin, {
      action: "sanction.revoke",
      resourceType: "sanction",
      resourceId: id,
      changedFields: ["revokedAt", "revokedBy", "revokeReason"],
      reason,
    }),
    (session) =>
      new AdminModerationMongoRepository().revokeSanction(
        id,
        auth.admin.id,
        reason,
        session,
      ),
    Boolean,
  );
  return result
    ? adminJson(result)
    : adminError(
        "CONFLICT",
        "이미 해제됐거나 존재하지 않는 제재입니다.",
        409,
        adminRequestId(request),
      );
}
