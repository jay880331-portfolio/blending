import type { SaveAdminUserCareerInput } from "@blending/admin-contracts";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import { assertNoOwnerOverride } from "@/application/admin/userUseCases";
import { validateCareerDrafts } from "@/domain/member/careerValidation";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import { AdminUserMongoRepository } from "@/infrastructure/mongodb/adminUserMongoRepository";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminAuditInput,
  adminRequestId,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";
import { readJson, requireString } from "@/infrastructure/server/http";

type Context = { params: Promise<{ userId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  return adminJson(
    await new AdminUserMongoRepository().listCareers((await params).userId),
  );
}

export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  const body = await readJson<SaveAdminUserCareerInput & { ownerId?: unknown }>(
    request,
  );
  try {
    assertNoOwnerOverride(body);
  } catch (error) {
    return invalid(request, (error as Error).message);
  }
  const career = careerInput(body, randomUUID());
  const reason = requireString(body.reason);
  if (!career || !reason)
    return invalid(request, "경력 정보와 사유를 확인해주세요.");
  const repository = new AdminUserMongoRepository();
  const userId = (await params).userId;
  const validation = validateCareerDrafts([
    ...(await repository.listCareers(userId)),
    career,
  ]);
  if (validation) return invalid(request, validation);
  await runAuditedMutation(
    adminUnitOfWork,
    adminAuditMongoRepository,
    adminAuditInput(request, auth.admin, {
      action: "user.update",
      resourceType: "user.career",
      resourceId: career.id,
      changedFields: ["career"],
      reason,
    }),
    (session) => repository.saveCareer(userId, career, session, true),
  );
  return adminJson(career, 201);
}

export function careerInput(
  body: Partial<SaveAdminUserCareerInput>,
  id: string,
) {
  const type =
    body.type === "career" || body.type === "award" ? body.type : null;
  const year = requireString(body.year);
  const title = requireString(body.title);
  const organization = requireString(body.organization);
  const detail = requireString(body.detail);
  const description = requireString(body.description);
  if (!type || !year || !title || !organization) return null;
  return {
    id,
    type,
    year,
    period: requireString(body.period) ?? year,
    title,
    organization,
    ...(detail ? { detail } : {}),
    ...(description ? { description } : {}),
    ...(typeof body.current === "boolean" ? { current: body.current } : {}),
  };
}

export function invalid(request: NextRequest, message: string) {
  return adminError("INVALID_INPUT", message, 400, adminRequestId(request));
}
