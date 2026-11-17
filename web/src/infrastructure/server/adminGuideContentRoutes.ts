import type {
  GuideContentKind,
  GuideContentWriteInput,
} from "@blending/admin-contracts";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import {
  changeGuideContentDeleted,
  createGuideContent,
  GuideContentConflictError,
  GuideContentNotFoundError,
  GuideContentValidationError,
  parseGuideContentListQuery,
  parseGuideContentInput,
  updateGuideContent,
} from "@/application/admin/guideContentUseCases";
import {
  schedulePublishedNoticeFanout,
  shouldFanOutPublishedNotice,
} from "@/infrastructure/server/memberActivityNotifications";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import { AdminGuideContentMongoRepository } from "@/infrastructure/mongodb/adminGuideContentMongoRepository";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { adminError, adminJson } from "./adminHttp";
import {
  adminAuditInput,
  adminRequestId,
  requireAdminApiRequest,
} from "./adminRequest";
import { readJson, requireString } from "./http";

export async function listGuideContent(
  request: NextRequest,
  kind: GuideContentKind,
) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  try {
    return adminJson(
      await new AdminGuideContentMongoRepository().list(
        kind,
        parseGuideContentListQuery(request.nextUrl.searchParams),
      ),
    );
  } catch (error) {
    return guideContentError(request, error);
  }
}

export async function createGuideContentRoute(
  request: NextRequest,
  kind: GuideContentKind,
) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await readJson<GuideContentWriteInput>(request);
    const input = parseGuideContentInput(kind, body.content);
    const id = randomUUID();
    await ensureMongoIndexes();
    const result = await runAuditedMutation(
      adminUnitOfWork,
      adminAuditMongoRepository,
      adminAuditInput(request, auth.admin, {
        action: "content.create",
        resourceType: kind,
        resourceId: id,
        changedFields: Object.keys(input),
      }),
      (session) =>
        createGuideContent(
          new AdminGuideContentMongoRepository(),
          kind,
          id,
          input,
          auth.admin.id,
          session,
        ),
    );
    if (
      shouldFanOutPublishedNotice(kind, result.status) &&
      "title" in result.data
    ) {
      schedulePublishedNoticeFanout({
        noticeId: result.id,
        title: result.data.title,
      });
    }
    return adminJson(result, 201);
  } catch (error) {
    return guideContentError(request, error);
  }
}

export async function getGuideContent(
  request: NextRequest,
  kind: GuideContentKind,
  id: string,
) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const result = await new AdminGuideContentMongoRepository().findById(
      kind,
      id,
    );
    return result
      ? adminJson(result)
      : adminError(
          "NOT_FOUND",
          "콘텐츠를 찾을 수 없습니다.",
          404,
          adminRequestId(request),
        );
  } catch (error) {
    return guideContentError(request, error);
  }
}

export async function updateGuideContentRoute(
  request: NextRequest,
  kind: GuideContentKind,
  id: string,
) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await readJson<GuideContentWriteInput>(request);
    const reason = requireString(body.reason);
    if (!reason)
      throw new GuideContentValidationError("수정 사유를 입력해주세요.");
    const input = parseGuideContentInput(kind, body.content);
    await ensureMongoIndexes();
    const previous =
      kind === "notice"
        ? await new AdminGuideContentMongoRepository().findById(kind, id)
        : null;
    const result = await runAuditedMutation(
      adminUnitOfWork,
      adminAuditMongoRepository,
      adminAuditInput(request, auth.admin, {
        action: "content.update",
        resourceType: kind,
        resourceId: id,
        changedFields: Object.keys(input),
        reason,
      }),
      (session) =>
        updateGuideContent(
          new AdminGuideContentMongoRepository(),
          kind,
          id,
          input,
          auth.admin.id,
          session,
        ),
    );
    if (
      shouldFanOutPublishedNotice(kind, result.status, previous?.status) &&
      "title" in result.data
    ) {
      schedulePublishedNoticeFanout({
        noticeId: result.id,
        title: result.data.title,
      });
    }
    return adminJson(result);
  } catch (error) {
    return guideContentError(request, error);
  }
}

export async function changeDeletedGuideContentRoute(
  request: NextRequest,
  kind: GuideContentKind,
  id: string,
  deleted: boolean,
) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  try {
    const reason = requireString(
      (await readJson<{ reason: string }>(request)).reason,
    );
    if (!reason)
      throw new GuideContentValidationError(
        `${deleted ? "삭제" : "복구"} 사유를 입력해주세요.`,
      );
    const result = await runAuditedMutation(
      adminUnitOfWork,
      adminAuditMongoRepository,
      adminAuditInput(request, auth.admin, {
        action: deleted ? "content.delete" : "content.restore",
        resourceType: kind,
        resourceId: id,
        changedFields: ["deletedAt"],
        reason,
      }),
      (session) =>
        changeGuideContentDeleted(
          new AdminGuideContentMongoRepository(),
          kind,
          id,
          deleted,
          auth.admin.id,
          session,
        ),
    );
    return adminJson(result);
  } catch (error) {
    return guideContentError(request, error);
  }
}

function guideContentError(request: NextRequest, error: unknown) {
  if (error instanceof GuideContentValidationError)
    return adminError(
      "INVALID_INPUT",
      error.message,
      400,
      adminRequestId(request),
    );
  if (error instanceof GuideContentNotFoundError)
    return adminError(
      "NOT_FOUND",
      "콘텐츠를 찾을 수 없습니다.",
      404,
      adminRequestId(request),
    );
  if (error instanceof GuideContentConflictError)
    return adminError("CONFLICT", error.message, 409, adminRequestId(request));
  return adminError(
    "INTERNAL_ERROR",
    "콘텐츠 요청을 처리하지 못했습니다.",
    500,
    adminRequestId(request),
  );
}
