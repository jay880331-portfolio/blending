import { NextResponse, type NextRequest } from "next/server";
import type {
  AdminSanctionListQuery,
  SanctionType,
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
    const type = request.nextUrl.searchParams.get("type") || undefined,
      active = request.nextUrl.searchParams.get("active");
    if (
      (type &&
        !["warning", "content_write_restriction", "suspension", "ban"].includes(
          type,
        )) ||
      (active && active !== "true" && active !== "false")
    )
      throw new Error("조회 조건을 확인해주세요.");
    const query: AdminSanctionListQuery = {
      ...base,
      userId: request.nextUrl.searchParams.get("userId") || undefined,
      type: type as SanctionType | undefined,
      active: active === "true",
    };
    return adminJson(
      await new AdminModerationMongoRepository().listSanctions(query),
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
