import { randomUUID } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { processAccountDeletionJobById } from "@/application/member/accountDeletionJobs";
import { AccountDeletionJobsMongoRepository } from "@/infrastructure/mongodb/accountDeletionJobsMongoRepository";
import { AccountDeletionMongoRepository } from "@/infrastructure/mongodb/accountDeletionMongoRepository";
import {
  clearSessionCookie,
  getCurrentUser,
} from "@/infrastructure/server/auth";
import {
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";
import {
  deleteOwnedUploadUrls,
  deletePrivateMemberUploadPrefix,
} from "@/infrastructure/server/r2";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";

export type DeleteMemberAccountInput = {
  reason: string;
  feedback?: string;
};

export type DeleteMemberAccountRouteDependencies = {
  getCurrentUser(request: NextRequest): Promise<{ id: string } | null>;
  clearSessionCookie(response: NextResponse): void;
  prepare(userId: string, withdrawnId: string): Promise<string>;
  process(id: string): Promise<unknown>;
  schedule(work: () => Promise<void>): void;
  createWithdrawnId(): string;
  ensureIndexes(): Promise<void>;
};

const jobs = new AccountDeletionJobsMongoRepository();
const cleanupRepository = new AccountDeletionMongoRepository();

const productionDependencies: DeleteMemberAccountRouteDependencies = {
  getCurrentUser,
  clearSessionCookie,
  prepare: (userId, withdrawnId) =>
    jobs.prepare(userId, withdrawnId, new Date()),
  process: (id) =>
    processAccountDeletionJobById(
      {
        jobs,
        cleanupRepository,
        deleteLegacyUploads: deleteOwnedUploadUrls,
        deletePrivatePrefix: deletePrivateMemberUploadPrefix,
        now: () => new Date(),
      },
      id,
    ),
  schedule: after,
  createWithdrawnId: () => `withdrawn:${randomUUID()}`,
  ensureIndexes: ensureMongoIndexes,
};

export function createDeleteMemberAccountRoute(
  dependencies: DeleteMemberAccountRouteDependencies = productionDependencies,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const user = await dependencies.getCurrentUser(request);
    if (!user) return jsonError("로그인이 필요합니다.", 401);

    const body = await readJson<DeleteMemberAccountInput>(request);
    const reason = requireString(body.reason);
    const feedback =
      body.feedback === undefined
        ? undefined
        : typeof body.feedback === "string"
          ? body.feedback.trim()
          : null;
    if (
      !reason ||
      reason.length > 100 ||
      feedback === null ||
      (typeof feedback === "string" && feedback.length > 1_000)
    )
      return jsonError("회원 탈퇴 사유를 확인해주세요.");

    let jobId: string;
    try {
      await dependencies.ensureIndexes();
      jobId = await dependencies.prepare(
        user.id,
        dependencies.createWithdrawnId(),
      );
    } catch {
      return jsonError("회원 탈퇴 처리에 실패했습니다.", 500);
    }

    dependencies.schedule(async () => {
      try {
        await dependencies.process(jobId);
      } catch {
        console.error("member_account_deletion_worker_failed", "worker_failed");
      }
    });

    const response = NextResponse.json(
      { success: true, pending: true },
      { status: 202 },
    );
    dependencies.clearSessionCookie(response);
    return response;
  };
}

export const deleteMemberAccountRoute: ReturnType<
  typeof createDeleteMemberAccountRoute
> = createDeleteMemberAccountRoute();
