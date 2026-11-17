import { NextResponse, type NextRequest } from "next/server";
import type {
  AdminReportListQuery,
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from "@blending/admin-contracts";
import { parseAdminListQuery } from "@/application/admin/adminListQuery";
import { AdminModerationMongoRepository } from "@/infrastructure/mongodb/adminModerationMongoRepository";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminRequestId,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const base = parseAdminListQuery(request.nextUrl.searchParams, [
      "createdAt",
    ]);
    const status = base.status || undefined,
      reason = request.nextUrl.searchParams.get("reason") || undefined,
      targetType = request.nextUrl.searchParams.get("targetType") || undefined;
    if (
      (status &&
        !["open", "investigating", "resolved", "dismissed"].includes(status)) ||
      (reason &&
        !["spam", "abuse", "privacy", "fraud", "other"].includes(reason)) ||
      (targetType &&
        !["user", "content", "comment", "message"].includes(targetType))
    )
      throw new Error("조회 조건을 확인해주세요.");
    const query: AdminReportListQuery = {
      ...base,
      status: status as ReportStatus | undefined,
      reason: reason as ReportReason | undefined,
      targetType: targetType as ReportTargetType | undefined,
    };
    return adminJson(
      await new AdminModerationMongoRepository().listReports(query),
    );
  } catch (error) {
    return adminError(
      "INVALID_INPUT",
      error instanceof Error ? error.message : "조회 조건을 확인해주세요.",
      400,
      adminRequestId(request),
    );
  }
}
