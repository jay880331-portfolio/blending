import type {
  AdminAppPopupDto,
  AdminAppPopupEnabledInput,
  AdminAppPopupInput,
} from "@blending/admin-contracts";
import { NextResponse, type NextRequest } from "next/server";
import {
  type AdminAuditRepository,
  type AdminUnitOfWork,
  adminUnitOfWork,
} from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import {
  AppPopupInputError,
  type AdminAppPopupRepository,
  parseAdminAppPopupInput,
} from "@/application/admin/appPopupUseCases";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import { appPopupMongoRepository } from "@/infrastructure/mongodb/appPopupMongoRepository";
import { adminError, adminJson } from "./adminHttp";
import {
  adminAuditInput,
  adminRequestId,
  requireAdminApiRequest,
} from "./adminRequest";
import { readJson } from "./http";

type Admin = Parameters<typeof adminAuditInput>[1];

export type AdminAppPopupRouteDependencies = {
  repository: AdminAppPopupRepository;
  unitOfWork: AdminUnitOfWork;
  auditRepository: AdminAuditRepository;
};

const dependencies: AdminAppPopupRouteDependencies = {
  repository: appPopupMongoRepository,
  unitOfWork: adminUnitOfWork,
  auditRepository: adminAuditMongoRepository,
};

export async function getAdminAppPopups(request: NextRequest) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  try {
    return await getAdminAppPopupsResponse(dependencies.repository);
  } catch (error) {
    return appPopupError(request, error);
  }
}

export async function getAdminAppPopupsResponse(
  repository: AdminAppPopupRepository,
) {
  return adminJson(await repository.list());
}

export async function createAdminAppPopup(request: NextRequest) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  return createAdminAppPopupResponse(request, auth.admin, dependencies);
}

export async function createAdminAppPopupResponse(
  request: NextRequest,
  admin: Admin,
  deps: AdminAppPopupRouteDependencies,
) {
  try {
    const input = parseAdminAppPopupInput(
      (await readJson<{ popup: AdminAppPopupInput }>(request)).popup,
    );
    const result = await runAuditedMutation<AdminAppPopupDto>(
      deps.unitOfWork,
      deps.auditRepository,
      (popup) =>
        popupAudit(request, admin, "popup.create", popup, Object.keys(input)),
      (session) => deps.repository.create(input, session),
    );
    return adminJson(result, 201);
  } catch (error) {
    return appPopupError(request, error);
  }
}

export async function getAdminAppPopup(request: NextRequest, id: string) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  try {
    return await getAdminAppPopupResponse(request, id, dependencies.repository);
  } catch (error) {
    return appPopupError(request, error);
  }
}

export async function getAdminAppPopupResponse(
  request: NextRequest,
  id: string,
  repository: AdminAppPopupRepository,
) {
  const popup = await repository.findById(id);
  return popup ? adminJson(popup) : popupNotFound(request);
}

export async function updateAdminAppPopup(request: NextRequest, id: string) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  return updateAdminAppPopupResponse(request, auth.admin, id, dependencies);
}

export async function deleteAdminAppPopup(request: NextRequest, id: string) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  return deleteAdminAppPopupResponse(request, auth.admin, id, dependencies);
}

export async function deleteAdminAppPopupResponse(
  request: NextRequest,
  admin: Admin,
  id: string,
  deps: AdminAppPopupRouteDependencies,
) {
  try {
    const result = await runAuditedMutation<AdminAppPopupDto | null>(
      deps.unitOfWork,
      deps.auditRepository,
      (popup) => {
        if (!popup) throw new Error("Popup not found");
        return popupAudit(request, admin, "popup.delete", popup, []);
      },
      (session) => deps.repository.delete(id, session),
      (popup) => popup !== null,
    );
    return result ? adminJson(result) : popupNotFound(request);
  } catch (error) {
    return appPopupError(request, error);
  }
}

export async function updateAdminAppPopupResponse(
  request: NextRequest,
  admin: Admin,
  id: string,
  deps: AdminAppPopupRouteDependencies,
) {
  try {
    const input = parseAdminAppPopupInput(
      (await readJson<{ popup: AdminAppPopupInput }>(request)).popup,
    );
    const result = await runAuditedMutation<AdminAppPopupDto | null>(
      deps.unitOfWork,
      deps.auditRepository,
      (popup) => {
        if (!popup) throw new Error("Popup not found");
        return popupAudit(
          request,
          admin,
          "popup.update",
          popup,
          Object.keys(input),
        );
      },
      (session) => deps.repository.update(id, input, session),
      (popup) => popup !== null,
    );
    return result ? adminJson(result) : popupNotFound(request);
  } catch (error) {
    return appPopupError(request, error);
  }
}

export async function toggleAdminAppPopup(request: NextRequest, id: string) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  return toggleAdminAppPopupResponse(request, auth.admin, id, dependencies);
}

export async function toggleAdminAppPopupResponse(
  request: NextRequest,
  admin: Admin,
  id: string,
  deps: AdminAppPopupRouteDependencies,
) {
  try {
    const { enabled } = await readJson<AdminAppPopupEnabledInput>(request);
    if (typeof enabled !== "boolean")
      throw new AppPopupInputError("노출 상태를 확인해주세요.");
    const result = await runAuditedMutation<AdminAppPopupDto | null>(
      deps.unitOfWork,
      deps.auditRepository,
      (popup) => {
        if (!popup) throw new Error("Popup not found");
        return popupAudit(request, admin, "popup.toggle", popup, ["enabled"]);
      },
      (session) => deps.repository.setEnabled(id, enabled, session),
      (popup) => popup !== null,
    );
    return result ? adminJson(result) : popupNotFound(request);
  } catch (error) {
    return appPopupError(request, error);
  }
}

function popupAudit(
  request: NextRequest,
  admin: Admin,
  action: "popup.create" | "popup.delete" | "popup.update" | "popup.toggle",
  popup: AdminAppPopupDto,
  changedFields: string[],
) {
  return adminAuditInput(request, admin, {
    action,
    resourceType: "app_popup",
    resourceId: popup.id,
    changedFields,
  });
}

function popupNotFound(request: NextRequest) {
  return adminError(
    "NOT_FOUND",
    "팝업을 찾을 수 없습니다.",
    404,
    adminRequestId(request),
  );
}

function appPopupError(request: NextRequest, error: unknown) {
  if (error instanceof AppPopupInputError)
    return adminError(
      "INVALID_INPUT",
      error.message,
      400,
      adminRequestId(request),
    );
  return adminError(
    "INTERNAL_ERROR",
    "팝업 요청을 처리하지 못했습니다.",
    500,
    adminRequestId(request),
  );
}
