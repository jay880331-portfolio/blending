import { NextResponse, type NextRequest } from "next/server";
import {
  createReportAndBlock,
  ModerationConflictError,
  ModerationNotFoundError,
  ModerationValidationError,
  parseCreateReportInput,
} from "@/application/admin/moderationUseCases";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { AdminModerationMongoRepository } from "@/infrastructure/mongodb/adminModerationMongoRepository";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import { operationGuardResponse } from "@/infrastructure/server/operationPolicy";

export async function POST(request: NextRequest) {
  const blocked = await operationGuardResponse("reportingEnabled");
  if (blocked) return blocked;
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  try {
    await ensureMongoIndexes();
    const input = parseCreateReportInput(await readJson(request));
    const result = await adminUnitOfWork.run((session) =>
      createReportAndBlock(
        new AdminModerationMongoRepository(),
        user.id,
        input,
        session,
      ),
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ModerationValidationError)
      return jsonError(error.message, 400);
    if (error instanceof ModerationNotFoundError)
      return jsonError(error.message, 404);
    if (
      error instanceof ModerationConflictError ||
      (error instanceof Error && /이미 접수|하루 10건/.test(error.message))
    )
      return jsonError(error.message, 409);
    return jsonError("신고를 접수하지 못했습니다.", 500);
  }
}
