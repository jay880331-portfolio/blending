import type { AdminContentWriteInput } from "@blending/admin-contracts";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { parseAdminContentListQuery } from "@/application/admin/adminContentListQuery";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import { adminContentError } from "@/application/admin/contentErrors";
import {
  createContent,
  parseAdminContentInput,
} from "@/application/admin/contentUseCases";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import {
  AdminContentInputError,
  AdminContentMongoRepository,
  isAdminContentKind,
} from "@/infrastructure/mongodb/adminContentMongoRepository";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { adminContentSearchMongoRepository } from "@/infrastructure/mongodb/searchMongoRepository";
import { adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminAuditInput,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";
import { readJson } from "@/infrastructure/server/http";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const query = parseAdminContentListQuery(request.nextUrl.searchParams);
    return adminJson(await new AdminContentMongoRepository().list(query));
  } catch (error) {
    return adminContentError(request, error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await readJson<AdminContentWriteInput>(request);
    const raw = body?.content ?? body;
    if (!raw || typeof raw !== "object")
      throw new AdminContentInputError("콘텐츠 입력을 확인해주세요.");
    const kind = (raw as { kind?: unknown }).kind;
    if (typeof kind !== "string" || !isAdminContentKind(kind))
      throw new AdminContentInputError("콘텐츠 종류를 확인해주세요.");
    const input = parseAdminContentInput(kind, raw);
    const id = randomUUID();
    await ensureMongoIndexes();
    const repository = new AdminContentMongoRepository();
    const content = await runAuditedMutation(
      adminUnitOfWork,
      adminAuditMongoRepository,
      adminAuditInput(request, auth.admin, {
        action: "content.create",
        resourceType: kind,
        resourceId: id,
        changedFields: Object.keys(input).filter((key) => key !== "kind"),
      }),
      (session) =>
        createContent(
          repository,
          adminContentSearchMongoRepository,
          kind,
          id,
          input,
          session,
        ),
    );
    return adminJson(content, 201);
  } catch (error) {
    return adminContentError(request, error);
  }
}
