import { NextResponse, type NextRequest } from "next/server";
import type { ClientSession } from "mongodb";
import type {
  AdminAuditRepository,
  AdminUnitOfWork,
} from "@/application/admin/adminUnitOfWork";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import type { FailedAccountDeletionJobDto } from "@/application/member/accountDeletionJobs";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import { AccountDeletionJobsMongoRepository } from "@/infrastructure/mongodb/accountDeletionJobsMongoRepository";
import { adminError, adminJson } from "./adminHttp";
import {
  adminAuditInput,
  adminRequestId,
  requireAdminApiRequest,
} from "./adminRequest";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";

type Admin = Parameters<typeof adminAuditInput>[1];
type FailedJobRepository = {
  listFailed(): Promise<FailedAccountDeletionJobDto[]>;
  retryFailed(id: string, now: Date, session: ClientSession): Promise<boolean>;
};

export type AdminAccountDeletionJobRouteDependencies = {
  jobs: FailedJobRepository;
  unitOfWork: AdminUnitOfWork;
  auditRepository: AdminAuditRepository;
  now(): Date;
  ensureIndexes(): Promise<void>;
};

const dependencies: AdminAccountDeletionJobRouteDependencies = {
  jobs: new AccountDeletionJobsMongoRepository(),
  unitOfWork: adminUnitOfWork,
  auditRepository: adminAuditMongoRepository,
  now: () => new Date(),
  ensureIndexes: ensureMongoIndexes,
};

export async function getAdminAccountDeletionJobs(request: NextRequest) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  try {
    await dependencies.ensureIndexes();
  } catch {
    return adminError(
      "INTERNAL_ERROR",
      "탈퇴 작업을 조회할 수 없습니다.",
      500,
      adminRequestId(request),
    );
  }
  return getAdminAccountDeletionJobsResponse(dependencies.jobs);
}

export async function getAdminAccountDeletionJobsResponse(
  jobs: Pick<FailedJobRepository, "listFailed">,
) {
  return adminJson((await jobs.listFailed()).map(safeJob));
}

export async function retryAdminAccountDeletionJob(
  request: NextRequest,
  id: string,
) {
  const auth = await requireAdminApiRequest(request, { mutation: true });
  if (auth instanceof NextResponse) return auth;
  try {
    await dependencies.ensureIndexes();
  } catch {
    return adminError(
      "INTERNAL_ERROR",
      "탈퇴 작업을 처리할 수 없습니다.",
      500,
      adminRequestId(request),
    );
  }
  return retryAdminAccountDeletionJobResponse(
    request,
    auth.admin,
    id,
    dependencies,
  );
}

export async function retryAdminAccountDeletionJobResponse(
  request: NextRequest,
  admin: Admin,
  id: string,
  deps: AdminAccountDeletionJobRouteDependencies,
) {
  if (!(await deps.jobs.listFailed()).some((job) => job.id === id))
    return jobNotFound(request);

  const retried = await runAuditedMutation(
    deps.unitOfWork,
    deps.auditRepository,
    adminAuditInput(request, admin, {
      action: "account_deletion.retry",
      resourceType: "account_deletion_job",
      resourceId: id,
      changedFields: [
        "status",
        "attempts",
        "cleanPasses",
        "nextAttemptAt",
        "deadlineAt",
        "lastErrorCode",
      ],
    }),
    (session) => deps.jobs.retryFailed(id, deps.now(), session),
    Boolean,
  );
  if (retried) return adminJson({ id, status: "pending" });
  return adminError(
    "CONFLICT",
    "탈퇴 작업 상태가 변경되었습니다.",
    409,
    adminRequestId(request),
  );
}

function safeJob(
  job: FailedAccountDeletionJobDto,
): FailedAccountDeletionJobDto {
  const {
    id,
    status,
    attempts,
    createdAt,
    updatedAt,
    deadlineAt,
    lastErrorCode,
  } = job;
  return {
    id,
    status,
    attempts,
    createdAt,
    updatedAt,
    deadlineAt,
    ...(lastErrorCode ? { lastErrorCode } : {}),
  };
}

function jobNotFound(request: NextRequest) {
  return adminError(
    "NOT_FOUND",
    "탈퇴 작업을 찾을 수 없습니다.",
    404,
    adminRequestId(request),
  );
}
