import type { SaveAdminUserCareerInput } from "@blending/admin-contracts";
import { NextResponse, type NextRequest } from "next/server";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import { assertNoOwnerOverride } from "@/application/admin/userUseCases";
import { validateCareerDrafts } from "@/domain/member/careerValidation";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import {
  AdminUserMongoRepository,
  AdminUserNotFoundError,
} from "@/infrastructure/mongodb/adminUserMongoRepository";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminAuditInput,
  adminRequestId,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";
import { readJson, requireString } from "@/infrastructure/server/http";
import { careerInput, invalid } from "../route";

type Context = { params: Promise<{ userId: string; careerId: string }> };

export async function PUT(request: NextRequest, { params }: Context) {
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
  const { userId, careerId } = await params;
  const career = careerInput(body, careerId);
  const reason = requireString(body.reason);
  if (!career || !reason)
    return invalid(request, "경력 정보와 사유를 확인해주세요.");
  const repository = new AdminUserMongoRepository();
  const validation = validateCareerDrafts([
    ...(await repository.listCareers(userId)).filter(
      (item) => item.id !== careerId,
    ),
    career,
  ]);
  if (validation) return invalid(request, validation);
  try {
    await runAuditedMutation(
      adminUnitOfWork,
      adminAuditMongoRepository,
      adminAuditInput(request, auth.admin, {
        action: "user.update",
        resourceType: "user.career",
        resourceId: careerId,
        changedFields: ["career"],
        reason,
      }),
      (session) => repository.saveCareer(userId, career, session),
    );
    return adminJson(career);
  } catch (error) {
    return error instanceof AdminUserNotFoundError
      ? adminError(
          "NOT_FOUND",
          "경력을 찾을 수 없습니다.",
          404,
          adminRequestId(request),
        )
      : invalid(request, "경력을 수정할 수 없습니다.");
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  const reason = requireString(
    (await readJson<{ reason: string }>(request)).reason,
  );
  if (!reason) return invalid(request, "삭제 사유를 입력해주세요.");
  const { userId, careerId } = await params;
  try {
    await runAuditedMutation(
      adminUnitOfWork,
      adminAuditMongoRepository,
      adminAuditInput(request, auth.admin, {
        action: "user.update",
        resourceType: "user.career",
        resourceId: careerId,
        changedFields: ["career"],
        reason,
      }),
      (session) =>
        new AdminUserMongoRepository().deleteCareer(userId, careerId, session),
    );
    return adminJson({ ok: true });
  } catch (error) {
    return error instanceof AdminUserNotFoundError
      ? adminError(
          "NOT_FOUND",
          "경력을 찾을 수 없습니다.",
          404,
          adminRequestId(request),
        )
      : invalid(request, "경력을 삭제할 수 없습니다.");
  }
}
