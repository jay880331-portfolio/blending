import { NextResponse, type NextRequest } from "next/server";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import {
  inspectSearchIndex,
  reconcileSearchIndex,
  SearchIndexBusyError,
} from "@/application/admin/searchIndexUseCases";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminAuditInput,
  adminRequestId,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  await ensureMongoIndexes();
  return adminJson(await inspectSearchIndex());
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureMongoIndexes();
    const run = await reconcileSearchIndex("admin", auth.admin.id);
    await runAuditedMutation(
      adminUnitOfWork,
      adminAuditMongoRepository,
      adminAuditInput(request, auth.admin, {
        action: "search.reconcile",
        resourceType: "search_index",
        resourceId: run.id,
        changedFields: ["indexedCount", "deletedCount", "status"],
      }),
      async () => run,
    );
    return adminJson(run);
  } catch (error) {
    if (error instanceof SearchIndexBusyError)
      return adminError(
        "CONFLICT",
        error.message,
        409,
        adminRequestId(request),
      );
    return adminError(
      "INTERNAL_ERROR",
      "검색 인덱스 정합성 작업을 완료하지 못했습니다.",
      500,
      adminRequestId(request),
    );
  }
}
