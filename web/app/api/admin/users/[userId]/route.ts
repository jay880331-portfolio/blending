import type { UpdateAdminManagedUserInput } from "@blending/admin-contracts";
import { NextResponse, type NextRequest } from "next/server";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import { changeUserStatus } from "@/application/admin/userUseCases";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import {
  AdminUserConflictError,
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

type Context = { params: Promise<{ userId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  const user = await new AdminUserMongoRepository().findDetail(
    (await params).userId,
  );
  return user
    ? adminJson(user)
    : adminError(
        "NOT_FOUND",
        "사용자를 찾을 수 없습니다.",
        404,
        adminRequestId(request),
      );
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  const userId = (await params).userId;
  const body = await readJson<UpdateAdminManagedUserInput>(request);
  const reason = requireString(body.reason);
  const name = body.name === undefined ? undefined : requireString(body.name);
  const handle =
    body.handle === undefined ? undefined : requireString(body.handle);
  const phone =
    body.phone === undefined
      ? undefined
      : requireString(body.phone)?.replace(/\D/g, "");
  const email =
    body.email === undefined
      ? undefined
      : requireString(body.email)?.toLowerCase();
  if (
    !reason ||
    (!name && !handle && !phone && !email) ||
    (phone !== undefined && phone.length < 10) ||
    (email !== undefined && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
  )
    return adminError(
      "INVALID_INPUT",
      "수정 정보와 사유를 확인해주세요.",
      400,
      adminRequestId(request),
    );
  const input = {
    ...(name ? { name } : {}),
    ...(handle ? { handle } : {}),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    reason,
  };
  const repository = new AdminUserMongoRepository();
  try {
    await runAuditedMutation(
      adminUnitOfWork,
      adminAuditMongoRepository,
      adminAuditInput(request, auth.admin, {
        action: "user.update",
        resourceType: "user",
        resourceId: userId,
        changedFields: Object.keys(input).filter((key) => key !== "reason"),
        reason,
      }),
      (session) => repository.update(userId, input, session),
    );
    return adminJson({ ok: true });
  } catch (error) {
    return mutationError(request, error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  const userId = (await params).userId;
  const reason = requireString(
    (await readJson<{ reason: string }>(request)).reason,
  );
  if (!reason)
    return adminError(
      "INVALID_INPUT",
      "삭제 사유를 입력해주세요.",
      400,
      adminRequestId(request),
    );
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
          { actorId: auth.admin.id, userId, status: "deleted", reason },
          repository,
          session,
        ),
      Boolean,
    );
    return adminJson({ ok: true });
  } catch (error) {
    return mutationError(request, error);
  }
}

function mutationError(request: NextRequest, error: unknown) {
  if (
    error instanceof AdminUserNotFoundError ||
    (error instanceof Error && /찾을 수/.test(error.message))
  )
    return adminError(
      "NOT_FOUND",
      "사용자를 찾을 수 없습니다.",
      404,
      adminRequestId(request),
    );
  if (error instanceof AdminUserConflictError)
    return adminError(
      "CONFLICT",
      "이미 사용 중인 정보입니다.",
      409,
      adminRequestId(request),
    );
  return adminError(
    "CONFLICT",
    error instanceof Error ? error.message : "사용자를 변경할 수 없습니다.",
    409,
    adminRequestId(request),
  );
}
