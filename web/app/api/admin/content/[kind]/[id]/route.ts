import type { AdminContentWriteInput } from "@blending/admin-contracts";
import { NextResponse, type NextRequest } from "next/server";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import { adminContentError } from "@/application/admin/contentErrors";
import {
  deleteContent,
  parseAdminContentInput,
  updateContent,
  type AdminContentUpdateResult,
} from "@/application/admin/contentUseCases";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import {
  AdminContentInputError,
  AdminContentMongoRepository,
  isAdminContentKind,
} from "@/infrastructure/mongodb/adminContentMongoRepository";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { adminContentSearchMongoRepository } from "@/infrastructure/mongodb/searchMongoRepository";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminAuditInput,
  adminRequestId,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";
import { readJson, requireString } from "@/infrastructure/server/http";

type Context = { params: Promise<{ kind: string; id: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  const { kind, id } = await params;
  if (!isAdminContentKind(kind))
    return adminContentError(
      request,
      new AdminContentInputError("콘텐츠 종류를 확인해주세요."),
    );
  const content = await new AdminContentMongoRepository().findById(kind, id);
  return content
    ? adminJson(content)
    : adminError(
        "NOT_FOUND",
        "콘텐츠를 찾을 수 없습니다.",
        404,
        adminRequestId(request),
      );
}

export async function PUT(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  try {
    const { kind, id } = await validParams(params);
    const body = await readJson<AdminContentWriteInput>(request);
    const reason = requireString(body.reason);
    if (!reason) throw new AdminContentInputError("수정 사유를 입력해주세요.");
    const input = parseAdminContentInput(kind, body.content);
    await ensureMongoIndexes();
    const repository = new AdminContentMongoRepository();
    const changedFields = Object.keys(input).filter(
      (key) => key !== "kind" && key !== "ownerId",
    );
    const result = await runAuditedMutation<AdminContentUpdateResult>(
      adminUnitOfWork,
      adminAuditMongoRepository,
      (mutation) =>
        adminAuditInput(request, auth.admin, {
          action: "content.update",
          resourceType: kind,
          resourceId: id,
          changedFields: [
            ...changedFields,
            ...(mutation.ownerClaimed ? ["ownerId"] : []),
          ],
          reason,
        }),
      (session) =>
        updateContent(
          repository,
          adminContentSearchMongoRepository,
          kind,
          id,
          input,
          session,
        ),
    );
    return adminJson(result.content);
  } catch (error) {
    return adminContentError(request, error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  try {
    const { kind, id } = await validParams(params);
    const reason = requireString(
      (await readJson<{ reason: string }>(request)).reason,
    );
    if (!reason) throw new AdminContentInputError("삭제 사유를 입력해주세요.");
    const repository = new AdminContentMongoRepository();
    const result = await runAuditedMutation(
      adminUnitOfWork,
      adminAuditMongoRepository,
      adminAuditInput(request, auth.admin, {
        action: "content.delete",
        resourceType: kind,
        resourceId: id,
        changedFields: ["moderationStatus"],
        reason,
      }),
      (session) =>
        deleteContent(
          repository,
          adminContentSearchMongoRepository,
          kind,
          id,
          reason,
          session,
        ),
      (value) => value.changed,
    );
    return adminJson(result.content);
  } catch (error) {
    return adminContentError(request, error);
  }
}

async function validParams(params: Context["params"]) {
  const value = await params;
  if (!isAdminContentKind(value.kind))
    throw new AdminContentInputError("콘텐츠 종류를 확인해주세요.");
  return { kind: value.kind, id: value.id };
}
