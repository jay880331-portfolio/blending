import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import {
  decideEventRequest,
  EventRequestConflictError,
  EventRequestValidationError,
  parseDecideEventRequestInput,
} from "@/application/admin/eventRequestUseCases";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import {
  AdminContentConflictError,
  AdminEventRequestMongoRepository,
} from "@/infrastructure/mongodb/adminContentMongoRepository";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { adminContentSearchMongoRepository } from "@/infrastructure/mongodb/searchMongoRepository";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminAuditInput,
  adminRequestId,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";
import { readJson } from "@/infrastructure/server/http";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const input = parseDecideEventRequestInput(await readJson(request));
    const eventId = randomUUID();
    await ensureMongoIndexes();
    const result = await runAuditedMutation(
      adminUnitOfWork,
      adminAuditMongoRepository,
      adminAuditInput(request, auth.admin, {
        action:
          input.decision === "approve"
            ? "event_request.approve"
            : "event_request.reject",
        resourceType: "event_request",
        resourceId: id,
        changedFields:
          input.decision === "approve" ? ["status", "eventId"] : ["status"],
        reason: input.reason,
      }),
      (session) =>
        decideEventRequest(
          new AdminEventRequestMongoRepository(),
          adminContentSearchMongoRepository,
          auth.admin,
          id,
          input,
          eventId,
          session,
        ),
    );
    return adminJson(result);
  } catch (error) {
    if (error instanceof EventRequestValidationError)
      return adminError(
        "INVALID_INPUT",
        error.message,
        400,
        adminRequestId(request),
      );
    if (
      error instanceof EventRequestConflictError ||
      error instanceof AdminContentConflictError
    )
      return adminError(
        "CONFLICT",
        error.message,
        409,
        adminRequestId(request),
      );
    return adminError(
      "INTERNAL_ERROR",
      "이벤트 요청을 처리하지 못했습니다.",
      500,
      adminRequestId(request),
    );
  }
}
