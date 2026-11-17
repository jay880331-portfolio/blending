import { NextResponse, type NextRequest } from "next/server";
import type { ResolveReportInput } from "@blending/admin-contracts";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import {
  ModerationConflictError,
  ModerationActionError,
  ModerationValidationError,
  resolveReport,
} from "@/application/admin/moderationUseCases";
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
export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  const report = await new AdminModerationMongoRepository().findReport(
    (await params).id,
  );
  return report
    ? adminJson(report)
    : adminError(
        "NOT_FOUND",
        "신고를 찾을 수 없습니다.",
        404,
        adminRequestId(request),
      );
}
export async function PATCH(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  const id = (await params).id;
  try {
    const input = await readJson<ResolveReportInput>(request);
    const resolution = input.resolution?.trim();
    if (
      !input ||
      (input.status !== "resolved" && input.status !== "dismissed") ||
      !resolution
    )
      throw new ModerationValidationError("처리 내용을 확인해주세요.");
    const validatedInput: ResolveReportInput = {
      ...input,
      status: input.status,
      resolution,
    };
    const repository = new AdminModerationMongoRepository();
    const result = await runAuditedMutation(
      adminUnitOfWork,
      adminAuditMongoRepository,
      adminAuditInput(request, auth.admin, {
        action: "report.resolve",
        resourceType: "report",
        resourceId: id,
        changedFields: [
          "status",
          "resolution",
          ...(validatedInput.contentAction &&
          validatedInput.contentAction !== "none"
            ? ["target.moderationStatus"]
            : []),
          ...(validatedInput.sanction ? ["sanction.type"] : []),
        ],
        reason: validatedInput.resolution,
      }),
      (session) =>
        resolveReport(repository, auth.admin, id, validatedInput, session),
    );
    return adminJson(result);
  } catch (error) {
    if (error instanceof ModerationValidationError)
      return adminError(
        "INVALID_INPUT",
        error.message,
        400,
        adminRequestId(request),
      );
    if (error instanceof ModerationConflictError)
      return adminError(
        "CONFLICT",
        error.message,
        409,
        adminRequestId(request),
      );
    if (error instanceof ModerationActionError)
      return adminError(
        "CONFLICT",
        error.message,
        409,
        adminRequestId(request),
      );
    return adminError(
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "신고를 처리하지 못했습니다.",
      500,
      adminRequestId(request),
    );
  }
}
