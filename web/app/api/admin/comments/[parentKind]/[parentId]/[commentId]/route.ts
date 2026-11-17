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
export async function DELETE(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  const { parentKind, parentId, commentId } = await params,
    reason = (await readJson<{ reason?: string }>(request)).reason?.trim();
  if ((parentKind !== "b-talk" && parentKind !== "qa") || !reason)
    return adminError(
      "INVALID_INPUT",
      "삭제 사유를 입력해주세요.",
      400,
      adminRequestId(request),
    );
  const result = await runAuditedMutation(
    adminUnitOfWork,
    adminAuditMongoRepository,
    adminAuditInput(request, auth.admin, {
      action: "content.delete",
      resourceType: "comment",
      resourceId: commentId,
      changedFields: ["isDeleted", "deletedAt"],
      reason,
    }),
    (session) =>
      new AdminModerationMongoRepository().setCommentDeleted(
        parentKind,
        parentId,
        commentId,
        true,
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
}
