import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuditLog } from "@/application/admin/auditUseCases";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminRequestId,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  try {
    return adminJson(
      await getAdminAuditLog(adminAuditMongoRepository, (await params).id),
    );
  } catch {
    return adminError(
      "NOT_FOUND",
      "감사 로그를 찾을 수 없습니다.",
      404,
      adminRequestId(request),
    );
  }
}
