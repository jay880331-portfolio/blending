import {
  ADMIN_USER_STATUSES,
  type AdminUserStatus,
} from "@blending/admin-contracts";
import { NextResponse, type NextRequest } from "next/server";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import { changeUserStatus } from "@/application/admin/userUseCases";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import { AdminUserMongoRepository } from "@/infrastructure/mongodb/adminUserMongoRepository";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminAuditInput,
  adminRequestId,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";
import { readJson, requireString } from "@/infrastructure/server/http";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  const body = await readJson<{ status: AdminUserStatus; reason: string }>(
    request,
  );
  const reason = requireString(body.reason);
  if (!ADMIN_USER_STATUSES.includes(body.status as AdminUserStatus) || !reason)
    return adminError(
      "INVALID_INPUT",
      "상태와 사유를 확인해주세요.",
      400,
      adminRequestId(request),
    );
  const userId = (await params).userId;
  const repository = new AdminUserMongoRepository();
  try {
    await runAuditedMutation(
      adminUnitOfWork,
      adminAuditMongoRepository,
      adminAuditInput(request, auth.admin, {
        action: "user.status_change",
        resourceType: "user",
        resourceId: userId,
        changedFields: ["accountStatus"],
        reason,
      }),
      (session) =>
        changeUserStatus(
          {
            actorId: auth.admin.id,
            userId,
            status: body.status as AdminUserStatus,
            reason,
          },
          repository,
          session,
        ),
      Boolean,
    );
    return adminJson({ ok: true });
  } catch (error) {
    if (error instanceof Error && /찾을 수/.test(error.message))
      return adminError(
        "NOT_FOUND",
        error.message,
        404,
        adminRequestId(request),
      );
    return adminError(
      "CONFLICT",
      error instanceof Error ? error.message : "상태를 변경할 수 없습니다.",
      409,
      adminRequestId(request),
    );
  }
}
