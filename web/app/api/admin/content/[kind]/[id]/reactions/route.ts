import {
  isAdminPageSize,
  type AdminContentReactionDeleteInput,
} from "@blending/admin-contracts";
import { NextResponse, type NextRequest } from "next/server";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import { adminContentError } from "@/application/admin/contentErrors";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import {
  AdminContentInputError,
  AdminContentMongoRepository,
  isAdminContentKind,
} from "@/infrastructure/mongodb/adminContentMongoRepository";
import { adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminAuditInput,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";
import { readJson, requireString } from "@/infrastructure/server/http";

type Context = { params: Promise<{ kind: string; id: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { kind, id } = await validParams(params);
    const page = Number(request.nextUrl.searchParams.get("page") ?? 1);
    const pageSize = Number(request.nextUrl.searchParams.get("pageSize") ?? 20);
    if (!Number.isInteger(page) || page < 1 || !isAdminPageSize(pageSize))
      throw new AdminContentInputError("페이지를 확인해주세요.");
    return adminJson(
      await new AdminContentMongoRepository().listReactions(
        kind,
        id,
        page,
        pageSize,
      ),
    );
  } catch (error) {
    return adminContentError(request, error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  try {
    const { kind, id } = await validParams(params);
    const body = await readJson<AdminContentReactionDeleteInput>(request);
    const reactionId = requireString(body.reactionId);
    const reason = requireString(body.reason);
    if (!reactionId || !reason)
      throw new AdminContentInputError("반응 ID와 삭제 사유를 확인해주세요.");
    const removed = await runAuditedMutation(
      adminUnitOfWork,
      adminAuditMongoRepository,
      adminAuditInput(request, auth.admin, {
        action: "content.update",
        resourceType: kind,
        resourceId: id,
        changedFields: ["likes"],
        reason,
      }),
      (session) =>
        new AdminContentMongoRepository().deleteReaction(
          kind,
          id,
          reactionId,
          session,
        ),
      Boolean,
    );
    return adminJson({ removed });
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
