import {
  ADMIN_USER_ROLES,
  type AdminUserRole,
  type CreateAdminManagedUserInput,
} from "@blending/admin-contracts";
import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { parseAdminUserListQuery } from "@/application/admin/adminUserListQuery";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import {
  AdminUserConflictError,
  AdminUserMongoRepository,
} from "@/infrastructure/mongodb/adminUserMongoRepository";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminAuditInput,
  adminRequestId,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";
import { readJson, requireString } from "@/infrastructure/server/http";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const query = parseAdminUserListQuery(request.nextUrl.searchParams);
    return adminJson(await new AdminUserMongoRepository().list(query));
  } catch (error) {
    return adminError(
      "INVALID_INPUT",
      error instanceof Error ? error.message : "조회 조건을 확인해주세요.",
      400,
      adminRequestId(request),
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  const body = await readJson<CreateAdminManagedUserInput>(request);
  const phone = requireString(body.phone)?.replace(/\D/g, "");
  const password = requireString(body.password);
  const name = requireString(body.name);
  const handle = requireString(body.handle);
  const role = body.role;
  const email =
    body.email === undefined
      ? undefined
      : requireString(body.email)?.toLowerCase();
  if (
    !phone ||
    phone.length < 10 ||
    !password ||
    password.length < 8 ||
    !name ||
    !handle ||
    (email !== undefined && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) ||
    !ADMIN_USER_ROLES.includes(role as AdminUserRole)
  ) {
    return adminError(
      "INVALID_INPUT",
      "사용자 정보를 확인해주세요.",
      400,
      adminRequestId(request),
    );
  }

  await ensureMongoIndexes();
  const repository = new AdminUserMongoRepository();
  const userId = randomUUID();
  try {
    const user = await runAuditedMutation(
      adminUnitOfWork,
      adminAuditMongoRepository,
      adminAuditInput(request, auth.admin, {
        action: "user.create",
        resourceType: "user",
        resourceId: userId,
        changedFields: [
          "phone",
          ...(email ? ["email"] : []),
          "name",
          "handle",
          "role",
          "accountStatus",
        ],
      }),
      (session) =>
        repository.create(
          {
            phone,
            ...(email ? { email } : {}),
            password,
            name,
            handle,
            role: role as AdminUserRole,
          },
          session,
          userId,
        ),
    );
    return adminJson(user, 201);
  } catch (error) {
    if (error instanceof AdminUserConflictError)
      return adminError(
        "CONFLICT",
        "이미 사용 중인 휴대폰 번호입니다.",
        409,
        adminRequestId(request),
      );
    throw error;
  }
}
