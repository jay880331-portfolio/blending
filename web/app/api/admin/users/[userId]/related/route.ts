import {
  ADMIN_USER_RELATED_KINDS,
  type AdminUserRelatedKind,
} from "@blending/admin-contracts";
import { NextResponse, type NextRequest } from "next/server";
import { parseAdminListQuery } from "@/application/admin/adminListQuery";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { listUserRelated } from "@/application/admin/userUseCases";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import { AdminUserMongoRepository } from "@/infrastructure/mongodb/adminUserMongoRepository";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminAuditInput,
  adminRequestId,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";

type Context = { params: Promise<{ userId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  const kind = request.nextUrl.searchParams.get("kind");
  if (!isRelatedKind(kind))
    return adminError(
      "INVALID_INPUT",
      "조회 종류를 확인해주세요.",
      400,
      adminRequestId(request),
    );
  try {
    const query = {
      ...parseAdminListQuery(request.nextUrl.searchParams, []),
      kind,
    };
    const userId = (await params).userId;
    const repository = new AdminUserMongoRepository();
    const page = await listUserRelated(
      auth.admin.id,
      userId,
      query,
      repository,
      async () => {
        const auditId = adminRequestId(request);
        await adminUnitOfWork.run((session) =>
          adminAuditMongoRepository.append(
            {
              ...adminAuditInput(request, auth.admin, {
                action: "sensitive.read",
                resourceType: `user.${kind}`,
                resourceId: userId,
                changedFields: [],
              }),
              requestId: auditId,
            },
            session,
          ),
        );
        return auditId;
      },
    );
    return adminJson(page);
  } catch (error) {
    return adminError(
      "INVALID_INPUT",
      error instanceof Error ? error.message : "조회 조건을 확인해주세요.",
      400,
      adminRequestId(request),
    );
  }
}

function isRelatedKind(value: string | null): value is AdminUserRelatedKind {
  return ADMIN_USER_RELATED_KINDS.includes(value as AdminUserRelatedKind);
}
