import type { UpdateAdminUserProfileInput } from "@blending/admin-contracts";
import { NextResponse, type NextRequest } from "next/server";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import { assertNoOwnerOverride } from "@/application/admin/userUseCases";
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

type Context = { params: Promise<{ userId: string }> };
const PROFILE_FIELDS = [
  "name",
  "handle",
  "workplace",
  "bio",
  "status",
  "isPortfolioPublic",
] as const;

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  const profile = await new AdminUserMongoRepository().findProfile(
    (await params).userId,
  );
  return profile
    ? adminJson(profile)
    : adminError(
        "NOT_FOUND",
        "프로필을 찾을 수 없습니다.",
        404,
        adminRequestId(request),
      );
}

export async function PUT(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  const body = await readJson<
    UpdateAdminUserProfileInput & { ownerId?: unknown }
  >(request);
  const reason = requireString(body.reason);
  try {
    assertNoOwnerOverride(body);
  } catch {
    return adminError(
      "INVALID_INPUT",
      "ownerId는 지정할 수 없습니다.",
      400,
      adminRequestId(request),
    );
  }
  if (!reason)
    return adminError(
      "INVALID_INPUT",
      "프로필 정보와 수정 사유를 확인해주세요.",
      400,
      adminRequestId(request),
    );
  const patch = Object.fromEntries(
    PROFILE_FIELDS.flatMap((field) =>
      body[field] === undefined ? [] : [[field, body[field]]],
    ),
  ) as Partial<Omit<UpdateAdminUserProfileInput, "reason">>;
  if (!Object.keys(patch).length || !validProfilePatch(patch))
    return adminError(
      "INVALID_INPUT",
      "프로필 값을 확인해주세요.",
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
        action: "user.update",
        resourceType: "user.profile",
        resourceId: userId,
        changedFields: Object.keys(patch),
        reason,
      }),
      (session) => repository.updateProfile(userId, patch, session),
    );
    return adminJson({ ok: true });
  } catch (error) {
    return error instanceof AdminUserNotFoundError
      ? adminError(
          "NOT_FOUND",
          "프로필을 찾을 수 없습니다.",
          404,
          adminRequestId(request),
        )
      : adminError(
          "INVALID_INPUT",
          "프로필을 수정할 수 없습니다.",
          400,
          adminRequestId(request),
        );
  }
}

function validProfilePatch(patch: Record<string, unknown>) {
  return Object.entries(patch).every(([key, value]) => {
    if (key === "isPortfolioPublic") return typeof value === "boolean";
    if (key === "status")
      return ["guest", "job-seeking", "focused"].includes(String(value));
    if (key === "name" || key === "handle")
      return typeof value === "string" && value.trim().length > 0;
    return typeof value === "string";
  });
}
