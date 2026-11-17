import type { AppVersionPolicyUpdate } from "@blending/admin-contracts";
import { NextResponse, type NextRequest } from "next/server";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import {
  SettingsConflictError,
  SettingsInputError,
  validateAppVersionPolicyUpdate,
} from "@/application/admin/appSettingsUseCases";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import { adminSettingsMongoRepository } from "@/infrastructure/mongodb/adminSettingsMongoRepository";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminAuditInput,
  adminRequestId,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";
import { readJson } from "@/infrastructure/server/http";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  return adminJson(await adminSettingsMongoRepository.getAppVersionPolicy());
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  try {
    const input = validateAppVersionPolicyUpdate(
      (await readJson<AppVersionPolicyUpdate>(
        request,
      )) as AppVersionPolicyUpdate,
    );
    const result = await runAuditedMutation(
      adminUnitOfWork,
      adminAuditMongoRepository,
      adminAuditInput(request, auth.admin, {
        action: "settings.update",
        resourceType: "app_version_policy",
        resourceId: "mobile_version_policy",
        changedFields: ["enabled", "message", "android", "ios"],
      }),
      (session) =>
        adminSettingsMongoRepository.updateAppVersionPolicy(
          input,
          auth.admin.name,
          session,
        ),
    );
    return adminJson(result);
  } catch (error) {
    if (error instanceof SettingsConflictError)
      return adminError(
        "CONFLICT",
        error.message,
        409,
        adminRequestId(request),
      );
    if (error instanceof SettingsInputError)
      return adminError(
        "INVALID_INPUT",
        error.message,
        400,
        adminRequestId(request),
      );
    throw error;
  }
}
