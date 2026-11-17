import {
  ADMIN_USER_ROLES,
  type AdminUserRole,
} from "@blending/admin-contracts";
import { NextResponse, type NextRequest } from "next/server";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import { changeUserRole } from "@/application/admin/userUseCases";
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
  const body = await readJson<{ role: AdminUserRole; reason: string }>(request);
  const reason = requireString(body.reason);
  if (!ADMIN_USER_ROLES.includes(body.role as AdminUserRole) || !reason)
    return adminError(
      "INVALID_INPUT",
      "역할과 사유를 확인해주세요.",
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
        action: "user.role_change",
        resourceType: "user",
        resourceId: userId,
        changedFields: ["role"],
        reason,
      }),
      (session) =>
        changeUserRole(
          { actorId: auth.admin.id, userId, role: body.role as AdminUserRole },
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
      error instanceof Error ? error.message : "역할을 변경할 수 없습니다.",
      409,
      adminRequestId(request),
    );
  }
}
