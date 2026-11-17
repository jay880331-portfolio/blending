import {
  ADMIN_USER_RELATED_KINDS,
  type AdminRelatedItemAction,
  type AdminUserRelatedKind,
} from "@blending/admin-contracts";
import { NextResponse, type NextRequest } from "next/server";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import {
  assertRelatedActionAllowed,
  relatedMutationAudit,
} from "@/application/admin/userUseCases";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import {
  AdminUserMongoRepository,
  AdminUserNotFoundError,
} from "@/infrastructure/mongodb/adminUserMongoRepository";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminAuditInput,
  adminRequestId,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";
import { readJson, requireString } from "@/infrastructure/server/http";

type Context = {
  params: Promise<{ userId: string; kind: string; itemId: string }>;
};

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  const { userId, kind, itemId } = await params;
  if (kind !== "messages") return invalidKind(request);
  const item = await new AdminUserMongoRepository().findRelatedMessage(
    userId,
    itemId,
  );
  if (!item)
    return adminError(
      "NOT_FOUND",
      "메시지를 찾을 수 없습니다.",
      404,
      adminRequestId(request),
    );
  const auditId = adminRequestId(request);
  await adminUnitOfWork.run((session) =>
    adminAuditMongoRepository.append(
      {
        ...adminAuditInput(request, auth.admin, {
          action: "sensitive.read",
          resourceType: "user.message",
          resourceId: itemId,
          changedFields: [],
        }),
        requestId: auditId,
      },
      session,
    ),
  );
  return adminJson({ item, auditId });
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  const { userId, kind, itemId } = await params;
  if (!isRelatedKind(kind)) return invalidKind(request);
  const body =
    await readJson<Partial<AdminRelatedItemAction & { enabled: boolean }>>(
      request,
    );
  const reason = requireString(body.reason);
  if (!reason)
    return adminError(
      "INVALID_INPUT",
      "처리 사유를 입력해주세요.",
      400,
      adminRequestId(request),
    );
  const repository = new AdminUserMongoRepository();
  const action = body.action;
  if (
    kind !== "settings" &&
    action !== "soft-delete" &&
    action !== "restore" &&
    action !== "revoke"
  )
    return invalidKind(request);
  if (kind !== "settings") {
    try {
      assertRelatedActionAllowed(kind, action!);
    } catch (error) {
      return adminError(
        "INVALID_INPUT",
        (error as Error).message,
        400,
        adminRequestId(request),
      );
    }
  }
  try {
    const audit = relatedMutationAudit(kind, action ?? "soft-delete");
    await runAuditedMutation(
      adminUnitOfWork,
      adminAuditMongoRepository,
      adminAuditInput(request, auth.admin, {
        action: audit.action,
        resourceType: `user.${kind}`,
        resourceId: itemId,
        changedFields: audit.changedFields,
        reason,
      }),
      async (session) => {
        if (kind === "settings" && typeof body.enabled === "boolean") {
          await repository.updateNotificationSetting(
            userId,
            itemId,
            body.enabled,
            session,
          );
          return true;
        }
        return repository.mutateRelated(
          userId,
          kind,
          itemId,
          { action: action!, reason },
          session,
        );
      },
      Boolean,
    );
    return adminJson({ ok: true });
  } catch (error) {
    if (error instanceof AdminUserNotFoundError)
      return adminError(
        "NOT_FOUND",
        "항목을 찾을 수 없습니다.",
        404,
        adminRequestId(request),
      );
    return adminError(
      "INVALID_INPUT",
      error instanceof Error ? error.message : "처리할 수 없습니다.",
      400,
      adminRequestId(request),
    );
  }
}

function isRelatedKind(value: string): value is AdminUserRelatedKind {
  return ADMIN_USER_RELATED_KINDS.includes(value as AdminUserRelatedKind);
}

function invalidKind(request: NextRequest) {
  return adminError(
    "INVALID_INPUT",
    "처리 종류를 확인해주세요.",
    400,
    adminRequestId(request),
  );
}
