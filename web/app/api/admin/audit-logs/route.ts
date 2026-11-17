import { NextResponse, type NextRequest } from "next/server";
import type {
  AdminAuditAction,
  AdminAuditListQuery,
} from "@blending/admin-contracts";
import { ADMIN_AUDIT_ACTIONS } from "@blending/admin-contracts";
import { parseAdminListQuery } from "@/application/admin/adminListQuery";
import type { AdminAuditRepository } from "@/application/admin/adminUnitOfWork";
import { listAdminAuditLogs } from "@/application/admin/auditUseCases";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminRequestId,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;

  return getAuditLogsResponse(request);
}

export async function getAuditLogsResponse(
  request: NextRequest,
  repository: AdminAuditRepository = adminAuditMongoRepository,
) {
  let query: AdminAuditListQuery;

  try {
    const base = parseAdminListQuery(request.nextUrl.searchParams, [
      "action",
      "actorName",
      "createdAt",
      "resourceType",
    ]);
    const action = value(request, "action") ?? base.status;
    if (action && !ADMIN_AUDIT_ACTIONS.includes(action as AdminAuditAction))
      throw new Error("작업 유형을 확인해주세요.");
    const from = dateBoundary(base.from, false);
    const to = dateBoundary(base.to, true);
    if (from && to && from > to) throw new Error("조회 기간을 확인해주세요.");
    query = {
      ...base,
      status: undefined,
      from,
      to,
      actorId: value(request, "actorId"),
      action: action as AdminAuditAction | undefined,
      resourceType: value(request, "resourceType"),
      resourceId: value(request, "resourceId"),
    };
  } catch (error) {
    return adminError(
      "INVALID_INPUT",
      error instanceof Error ? error.message : "조회 조건을 확인해주세요.",
      400,
      adminRequestId(request),
    );
  }

  try {
    return adminJson(await listAdminAuditLogs(repository, query));
  } catch {
    return adminError(
      "INTERNAL_ERROR",
      "감사 로그를 조회하지 못했습니다.",
      500,
      adminRequestId(request),
    );
  }
}

function value(request: NextRequest, key: string) {
  return request.nextUrl.searchParams.get(key)?.trim() || undefined;
}

function dateBoundary(value: string | undefined, end: boolean) {
  if (!value) return undefined;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(
    dateOnly
      ? `${value}T${end ? "23:59:59.999" : "00:00:00.000"}+09:00`
      : value,
  );
  if (!Number.isFinite(date.getTime()))
    throw new Error("조회 기간을 확인해주세요.");
  return date.toISOString();
}
