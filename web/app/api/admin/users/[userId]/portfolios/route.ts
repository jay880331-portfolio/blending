import type { SaveAdminUserPortfolioInput } from "@blending/admin-contracts";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import { assertNoOwnerOverride } from "@/application/admin/userUseCases";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import { AdminUserMongoRepository } from "@/infrastructure/mongodb/adminUserMongoRepository";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminAuditInput,
  adminRequestId,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";
import {
  compactStrings,
  readJson,
  requireString,
} from "@/infrastructure/server/http";

type Context = { params: Promise<{ userId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  return adminJson(
    await new AdminUserMongoRepository().listPortfolios((await params).userId),
  );
}

export async function POST(request: NextRequest, { params }: Context) {
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
  const portfolio = portfolioInput(body, randomUUID());
  const reason = requireString(body.reason);
  if (!portfolio || !reason)
    return invalidPortfolio(
      request,
      "포트폴리오 제목, 내용과 수정 사유를 확인해주세요.",
    );
  const userId = (await params).userId;
  await runAuditedMutation(
    adminUnitOfWork,
    adminAuditMongoRepository,
    adminAuditInput(request, auth.admin, {
      action: "user.update",
      resourceType: "user.portfolio",
      resourceId: portfolio.id,
      changedFields: ["portfolio"],
      reason,
    }),
    (session) =>
      new AdminUserMongoRepository().savePortfolio(
        userId,
        portfolio,
        session,
        true,
      ),
  );
  return adminJson(portfolio, 201);
}

export function portfolioInput(
  body: Partial<SaveAdminUserPortfolioInput>,
  id: string,
) {
  const title = requireString(body.title);
  const summary = requireString(body.summary);
  if (!title || !summary) return null;
  return {
    id,
    title,
    summary,
    imageUrls: compactStrings(body.imageUrls),
    createdAt: requireString(body.createdAt) ?? new Date().toISOString(),
  };
}

export function invalidPortfolio(request: NextRequest, message: string) {
  return adminError("INVALID_INPUT", message, 400, adminRequestId(request));
}
