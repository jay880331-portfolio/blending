import type {
  AdminProfileBadgeDto,
  AdminUserBadgeDto,
  AssignAdminUserBadgeInput,
  UnassignAdminUserBadgeInput,
} from "@blending/admin-contracts";
import { NextResponse, type NextRequest } from "next/server";
import {
  type AdminAuditRepository,
  type AdminUnitOfWork,
  adminUnitOfWork,
} from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import {
  ProfileBadgeConflictError,
  ProfileBadgeInputError,
  type AdminProfileBadgeRepository,
  parseAdminProfileBadgeInput,
  parseAssignAdminUserBadgeInput,
  parseUnassignAdminUserBadgeInput,
} from "@/application/admin/profileBadgeUseCases";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import { profileBadgeMongoRepository } from "@/infrastructure/mongodb/profileBadgeMongoRepository";
import { adminError, adminJson } from "./adminHttp";
import {
  adminAuditInput,
  adminRequestId,
  requireAdminApiRequest,
} from "./adminRequest";
import { readJson } from "./http";

type Admin = Parameters<typeof adminAuditInput>[1];

export type AdminProfileBadgeRouteDependencies = {
  repository: AdminProfileBadgeRepository;
  unitOfWork: AdminUnitOfWork;
  auditRepository: AdminAuditRepository;
};

const dependencies: AdminProfileBadgeRouteDependencies = {
  repository: profileBadgeMongoRepository,
  unitOfWork: adminUnitOfWork,
  auditRepository: adminAuditMongoRepository,
};

export async function getAdminProfileBadges(request: NextRequest) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  return adminJson(await dependencies.repository.list());
}

export async function createAdminProfileBadge(request: NextRequest) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  return createAdminProfileBadgeResponse(request, auth.admin, dependencies);
}

export async function createAdminProfileBadgeResponse(
  request: NextRequest,
  admin: Admin,
  deps: AdminProfileBadgeRouteDependencies,
) {
  try {
    const input = parseAdminProfileBadgeInput(
      (await readJson<{ badge: unknown }>(request)).badge,
    );
    const result = await runAuditedMutation<AdminProfileBadgeDto>(
      deps.unitOfWork,
      deps.auditRepository,
      (badge) =>
        catalogAudit(request, admin, "profile_badge.create", badge, [
          "name",
          "icon",
          "imageUrl",
          "sortOrder",
        ]),
      (session) => deps.repository.create(input, session),
    );
    return adminJson(result, 201);
  } catch (error) {
    return profileBadgeError(request, error);
  }
}

export async function updateAdminProfileBadge(
  request: NextRequest,
  id: string,
) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  return updateAdminProfileBadgeResponse(request, auth.admin, id, dependencies);
}

export async function updateAdminProfileBadgeResponse(
  request: NextRequest,
  admin: Admin,
  id: string,
  deps: AdminProfileBadgeRouteDependencies,
) {
  try {
    const input = parseAdminProfileBadgeInput(
      (await readJson<{ badge: unknown }>(request)).badge,
    );
    const result = await runAuditedMutation<AdminProfileBadgeDto | null>(
      deps.unitOfWork,
      deps.auditRepository,
      (badge) => {
        if (!badge) throw new Error("Badge not found");
        return catalogAudit(request, admin, "profile_badge.update", badge, [
          "name",
          "icon",
          "imageUrl",
          "sortOrder",
        ]);
      },
      (session) => deps.repository.update(id, input, session),
      (badge) => badge !== null,
    );
    return result ? adminJson(result) : badgeNotFound(request);
  } catch (error) {
    return profileBadgeError(request, error);
  }
}

export async function deleteAdminProfileBadge(
  request: NextRequest,
  id: string,
) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  return deleteAdminProfileBadgeResponse(request, auth.admin, id, dependencies);
}

export async function deleteAdminProfileBadgeResponse(
  request: NextRequest,
  admin: Admin,
  id: string,
  deps: AdminProfileBadgeRouteDependencies,
) {
  try {
    const result = await runAuditedMutation<AdminProfileBadgeDto | null>(
      deps.unitOfWork,
      deps.auditRepository,
      (badge) => {
        if (!badge) throw new Error("Badge not found");
        return catalogAudit(request, admin, "profile_badge.delete", badge, [
          "badge",
        ]);
      },
      (session) => deps.repository.delete(id, session),
      (badge) => badge !== null,
    );
    return result ? adminJson(result) : badgeNotFound(request);
  } catch (error) {
    return profileBadgeError(request, error);
  }
}

export async function getAdminUserBadges(request: NextRequest, userId: string) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  return adminJson(await dependencies.repository.listAssignments(userId));
}

export async function assignAdminUserBadge(
  request: NextRequest,
  userId: string,
) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  return assignAdminUserBadgeResponse(
    request,
    auth.admin,
    userId,
    dependencies,
  );
}

export async function assignAdminUserBadgeResponse(
  request: NextRequest,
  admin: Admin,
  userId: string,
  deps: AdminProfileBadgeRouteDependencies,
) {
  try {
    const input = parseAssignAdminUserBadgeInput(
      await readJson<AssignAdminUserBadgeInput>(request),
    );
    const result = await runAuditedMutation<AdminUserBadgeDto>(
      deps.unitOfWork,
      deps.auditRepository,
      (badge) =>
        adminAuditInput(request, admin, {
          action: "user.update",
          resourceType: "user.badge",
          resourceId: badge.assignmentId,
          changedFields: ["badge"],
          reason: input.reason,
        }),
      (session) =>
        deps.repository.assign(userId, input.badgeId, admin.id, session),
    );
    return adminJson(result, 201);
  } catch (error) {
    return profileBadgeError(request, error);
  }
}

export async function unassignAdminUserBadge(
  request: NextRequest,
  userId: string,
  badgeId: string,
) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  return unassignAdminUserBadgeResponse(
    request,
    auth.admin,
    userId,
    badgeId,
    dependencies,
  );
}

export async function unassignAdminUserBadgeResponse(
  request: NextRequest,
  admin: Admin,
  userId: string,
  badgeId: string,
  deps: AdminProfileBadgeRouteDependencies,
) {
  try {
    const input = parseUnassignAdminUserBadgeInput(
      await readJson<UnassignAdminUserBadgeInput>(request),
    );
    const result = await runAuditedMutation<AdminUserBadgeDto | null>(
      deps.unitOfWork,
      deps.auditRepository,
      (badge) => {
        if (!badge) throw new Error("Assignment not found");
        return adminAuditInput(request, admin, {
          action: "user.update",
          resourceType: "user.badge",
          resourceId: badge.assignmentId,
          changedFields: ["badge"],
          reason: input.reason,
        });
      },
      (session) => deps.repository.unassign(userId, badgeId, session),
      (badge) => badge !== null,
    );
    return result ? adminJson(result) : assignmentNotFound(request);
  } catch (error) {
    return profileBadgeError(request, error);
  }
}

function catalogAudit(
  request: NextRequest,
  admin: Admin,
  action:
    | "profile_badge.create"
    | "profile_badge.update"
    | "profile_badge.delete",
  badge: AdminProfileBadgeDto,
  changedFields: string[],
) {
  return adminAuditInput(request, admin, {
    action,
    resourceType: "profile_badge",
    resourceId: badge.id,
    changedFields,
  });
}

function badgeNotFound(request: NextRequest) {
  return adminError(
    "NOT_FOUND",
    "뱃지를 찾을 수 없습니다.",
    404,
    adminRequestId(request),
  );
}

function assignmentNotFound(request: NextRequest) {
  return adminError(
    "NOT_FOUND",
    "부여된 뱃지를 찾을 수 없습니다.",
    404,
    adminRequestId(request),
  );
}

function profileBadgeError(request: NextRequest, error: unknown) {
  if (error instanceof ProfileBadgeInputError)
    return adminError(
      "INVALID_INPUT",
      error.message,
      400,
      adminRequestId(request),
    );
  if (error instanceof ProfileBadgeConflictError)
    return adminError("CONFLICT", error.message, 409, adminRequestId(request));
  throw error;
}
