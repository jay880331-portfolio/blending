import { NextResponse, type NextRequest } from "next/server";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import { AdminModerationMongoRepository } from "@/infrastructure/mongodb/adminModerationMongoRepository";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminAuditInput,
  adminRequestId,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";
import { readJson } from "@/infrastructure/server/http";
type Context = {
  params: Promise<{ parentKind: string; parentId: string; commentId: string }>;
};
export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  const { parentKind, parentId, commentId } = await params,
    reason = (await readJson<{ reason?: string }>(request)).reason?.trim();
  if ((parentKind !== "b-talk" && parentKind !== "qa") || !reason)
    return adminError(
      "INVALID_INPUT",
      "복구 사유를 입력해주세요.",
      400,
      adminRequestId(request),
    );
  try {
    const result = await runAuditedMutation(
      adminUnitOfWork,
      adminAuditMongoRepository,
      adminAuditInput(request, auth.admin, {
        action: "content.restore",
        resourceType: "comment",
        resourceId: commentId,
        changedFields: ["isDeleted", "restoredAt"],
        reason,
      }),
      (session) =>
        new AdminModerationMongoRepository().setCommentDeleted(
          parentKind,
          parentId,
          commentId,
          false,
          auth.admin.id,
          reason,
          session,
        ),
      Boolean,
    );
    return result
      ? adminJson(result)
      : adminError(
          "NOT_FOUND",
          "댓글을 찾을 수 없습니다.",
          404,
          adminRequestId(request),
        );
  } catch (error) {
    return adminError(
      "CONFLICT",
      error instanceof Error ? error.message : "댓글을 복구하지 못했습니다.",
      409,
      adminRequestId(request),
    );
  }
}
