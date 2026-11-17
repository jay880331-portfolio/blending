import { NextResponse, type NextRequest } from "next/server";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import { adminContentError } from "@/application/admin/contentErrors";
import { hideContent } from "@/application/admin/contentUseCases";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import {
  AdminContentInputError,
  AdminContentMongoRepository,
  isAdminContentKind,
} from "@/infrastructure/mongodb/adminContentMongoRepository";
import { adminContentSearchMongoRepository } from "@/infrastructure/mongodb/searchMongoRepository";
import { adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminAuditInput,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";
import { readJson, requireString } from "@/infrastructure/server/http";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  try {
    const { kind, id } = await params;
    if (!isAdminContentKind(kind))
      throw new AdminContentInputError("콘텐츠 종류를 확인해주세요.");
    const reason = requireString(
      (await readJson<{ reason: string }>(request)).reason,
    );
    if (!reason) throw new AdminContentInputError("숨김 사유를 입력해주세요.");
    const result = await runAuditedMutation(
      adminUnitOfWork,
      adminAuditMongoRepository,
      adminAuditInput(request, auth.admin, {
        action: "content.hide",
        resourceType: kind,
        resourceId: id,
        changedFields: ["moderationStatus"],
        reason,
      }),
      (session) =>
        hideContent(
          new AdminContentMongoRepository(),
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
