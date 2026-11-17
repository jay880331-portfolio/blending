import type { SaveAdminUserPortfolioInput } from "@blending/admin-contracts";
import { NextResponse, type NextRequest } from "next/server";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import { assertNoOwnerOverride } from "@/application/admin/userUseCases";
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
import { invalidPortfolio, portfolioInput } from "../route";

type Context = {
  params: Promise<{ userId: string; portfolioId: string }>;
};

export async function PUT(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  const body = await readJson<
    SaveAdminUserPortfolioInput & { ownerId?: unknown }
  >(request);
  try {
    assertNoOwnerOverride(body);
  } catch (error) {
    return invalidPortfolio(request, (error as Error).message);
  }
  const { userId, portfolioId } = await params;
  const portfolio = portfolioInput(body, portfolioId);
  const reason = requireString(body.reason);
  if (!portfolio || !reason)
    return invalidPortfolio(request, "포트폴리오 정보와 사유를 확인해주세요.");
  try {
    await runAuditedMutation(
      adminUnitOfWork,
      adminAuditMongoRepository,
      adminAuditInput(request, auth.admin, {
        action: "user.update",
        resourceType: "user.portfolio",
        resourceId: portfolioId,
        changedFields: ["portfolio"],
        reason,
      }),
      (session) =>
        new AdminUserMongoRepository().savePortfolio(
          userId,
          portfolio,
          session,
        ),
    );
    return adminJson(portfolio);
  } catch (error) {
    return error instanceof AdminUserNotFoundError
      ? adminError(
          "NOT_FOUND",
          "포트폴리오를 찾을 수 없습니다.",
          404,
          adminRequestId(request),
        )
      : invalidPortfolio(request, "포트폴리오를 수정할 수 없습니다.");
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  const reason = requireString(
    (await readJson<{ reason: string }>(request)).reason,
  );
  if (!reason) return invalidPortfolio(request, "삭제 사유를 입력해주세요.");
  const { userId, portfolioId } = await params;
  try {
    await runAuditedMutation(
      adminUnitOfWork,
      adminAuditMongoRepository,
      adminAuditInput(request, auth.admin, {
        action: "user.update",
        resourceType: "user.portfolio",
        resourceId: portfolioId,
        changedFields: ["portfolio"],
        reason,
      }),
      (session) =>
        new AdminUserMongoRepository().deletePortfolio(
          userId,
          portfolioId,
          session,
        ),
    );
    return adminJson({ ok: true });
  } catch (error) {
    return error instanceof AdminUserNotFoundError
      ? adminError(
          "NOT_FOUND",
          "포트폴리오를 찾을 수 없습니다.",
          404,
          adminRequestId(request),
        )
      : invalidPortfolio(request, "포트폴리오를 삭제할 수 없습니다.");
  }
}
