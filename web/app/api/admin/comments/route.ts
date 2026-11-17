import { NextResponse, type NextRequest } from "next/server";
import { isAdminPageSize } from "@blending/admin-contracts";
import { AdminModerationMongoRepository } from "@/infrastructure/mongodb/adminModerationMongoRepository";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminRequestId,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  const page = Number(request.nextUrl.searchParams.get("page") ?? 1),
    pageSize = Number(request.nextUrl.searchParams.get("pageSize") ?? 20);
  if (!Number.isInteger(page) || page < 1 || !isAdminPageSize(pageSize))
    return adminError(
      "INVALID_INPUT",
      "페이지를 확인해주세요.",
      400,
      adminRequestId(request),
    );
  const value = request.nextUrl.searchParams.get("deleted");
  if (value !== null && value !== "true" && value !== "false")
    return adminError(
      "INVALID_INPUT",
      "삭제 상태를 확인해주세요.",
      400,
      adminRequestId(request),
    );
  const parentKind = request.nextUrl.searchParams.get("parentKind"),
    parentId = request.nextUrl.searchParams.get("parentId");
  if (
    (parentKind !== null && parentKind !== "b-talk" && parentKind !== "qa") ||
    Boolean(parentKind) !== Boolean(parentId)
  )
    return adminError(
      "INVALID_INPUT",
      "댓글 대상을 확인해주세요.",
      400,
      adminRequestId(request),
    );
  return adminJson(
    await new AdminModerationMongoRepository().listComments(
      page,
      pageSize,
      value === null ? undefined : value === "true",
      parentKind as "b-talk" | "qa" | undefined,
      parentId ?? undefined,
    ),
  );
}
