import type {
  CreateReportInput,
  ResolveReportInput,
  SanctionType,
} from "@blending/admin-contracts";
import type { ClientSession } from "mongodb";

export class ModerationValidationError extends Error {}
export class ModerationConflictError extends Error {}
export class ModerationNotFoundError extends Error {}
export class ModerationActionError extends Error {}

export type ReportIngressRepository = {
  countToday(
    reporterId: string,
    since: Date,
    session?: ClientSession,
  ): Promise<number>;
  findOpen(
    reporterId: string,
    input: Pick<CreateReportInput, "targetType" | "targetId" | "parentId">,
    session?: ClientSession,
  ): Promise<unknown | null>;
  targetExists(
    input: Pick<CreateReportInput, "targetType" | "targetId" | "parentId">,
    session?: ClientSession,
  ): Promise<boolean>;
  resolveTargetUserId(
    reporterId: string,
    input: Pick<CreateReportInput, "targetType" | "targetId" | "parentId">,
    session?: ClientSession,
  ): Promise<string | null>;
  create(
    value: Record<string, unknown>,
    session?: ClientSession,
  ): Promise<unknown>;
};

export async function createReport(
  repository: ReportIngressRepository,
  reporterId: string,
  raw: CreateReportInput,
  session?: ClientSession,
) {
  const input = parseCreateReportInput(raw);
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  if ((await repository.countToday(reporterId, since, session)) >= 10)
    throw new ModerationConflictError(
      "신고는 하루 10건까지 접수할 수 있습니다.",
    );
  if (!(await repository.targetExists(input, session)))
    throw new ModerationNotFoundError("신고 대상을 찾을 수 없습니다.");
  const targetUserId = await repository.resolveTargetUserId(
    reporterId,
    input,
    session,
  );
  if (input.targetType === "message" && !targetUserId)
    throw new ModerationValidationError(
      "신고 대상 대화에 참여한 사용자만 신고할 수 있습니다.",
    );
  if (await repository.findOpen(reporterId, input, session))
    throw new ModerationConflictError("이미 접수된 신고입니다.");
  const now = new Date().toISOString();
  return repository.create(
    {
      id: crypto.randomUUID(),
      reporterId,
      ...input,
      ...(targetUserId ? { targetUserId } : {}),
      activeKey: "open",
      status: "open",
      createdAt: now,
      updatedAt: now,
    },
    session,
  );
}

export type ReportAndBlockRepository = ReportIngressRepository & {
  createBlock(
    blockerId: string,
    blockedId: string,
    session: ClientSession,
  ): Promise<void>;
};

export async function createReportAndBlock(
  repository: ReportAndBlockRepository,
  reporterId: string,
  raw: CreateReportInput,
  session: ClientSession,
) {
  const input = parseCreateReportInput(raw);
  const blockUserId = text(raw.blockUserId);
  if (raw.blockUserId !== undefined && !blockUserId)
    throw new ModerationValidationError("차단 대상을 확인해주세요.");
  const targetUserId = await repository.resolveTargetUserId(
    reporterId,
    input,
    session,
  );
  if (input.targetType === "message" && !targetUserId)
    throw new ModerationValidationError(
      "신고 대상 대화에 참여한 사용자만 신고할 수 있습니다.",
    );
  if (blockUserId && !targetUserId)
    throw new ModerationNotFoundError("신고 대상을 찾을 수 없습니다.");
  if (blockUserId && blockUserId !== targetUserId)
    throw new ModerationValidationError(
      "신고 대상과 차단 대상이 일치하지 않습니다.",
    );
  if (blockUserId === reporterId)
    throw new ModerationValidationError("자기 자신은 차단할 수 없습니다.");
  const report = await createReport(repository, reporterId, input, session);
  if (blockUserId)
    await repository.createBlock(reporterId, blockUserId, session);
  return report;
}

export function parseCreateReportInput(value: unknown): CreateReportInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ModerationValidationError("신고 내용을 확인해주세요.");
  const input = value as Record<string, unknown>;
  const targetType = input.targetType;
  const reason = input.reason;
  if (
    !(["user", "content", "comment", "message"] as unknown[]).includes(
      targetType,
    )
  )
    throw new ModerationValidationError("신고 대상을 확인해주세요.");
  if (
    !(["spam", "abuse", "privacy", "fraud", "other"] as unknown[]).includes(
      reason,
    )
  )
    throw new ModerationValidationError("신고 사유를 확인해주세요.");
  const targetId = text(input.targetId);
  const detail = text(input.detail)
    .replace(/<[^>]*>/g, "")
    .trim();
  if (!targetId || detail.length < 20 || detail.length > 1000)
    throw new ModerationValidationError(
      "신고 상세는 20~1000자로 입력해주세요.",
    );
  return {
    targetType: targetType as CreateReportInput["targetType"],
    targetId,
    ...(text(input.parentId) ? { parentId: text(input.parentId) } : {}),
    reason: reason as CreateReportInput["reason"],
    detail,
    ...(text(input.blockUserId)
      ? { blockUserId: text(input.blockUserId) }
      : {}),
  };
}

export type ModerationDecisionRepository = {
  findForDecision(
    id: string,
    session: ClientSession,
  ): Promise<{ targetType: string } | null>;
  resolvePending(
    id: string,
    patch: Record<string, unknown>,
    session: ClientSession,
  ): Promise<unknown | null>;
  applyContentAction?(
    id: string,
    action: "hide" | "delete",
    resolution: string,
    session: ClientSession,
  ): Promise<void>;
  createSanction?(
    value: Record<string, unknown>,
    session: ClientSession,
  ): Promise<void>;
  updateUserStatus?(
    userId: string,
    status: "suspended" | "deleted",
    reason: string,
    session: ClientSession,
  ): Promise<void>;
};

export async function resolveReport(
  repository: ModerationDecisionRepository,
  actor: { id: string },
  reportId: string,
  input: ResolveReportInput,
  session: ClientSession,
) {
  const resolution = input.resolution?.trim();
  if (
    !resolution ||
    (input.status !== "resolved" && input.status !== "dismissed")
  )
    throw new ModerationValidationError("처리 사유를 입력해주세요.");
  if (
    input.contentAction &&
    !["none", "hide", "delete"].includes(input.contentAction)
  )
    throw new ModerationValidationError("콘텐츠 조치를 확인해주세요.");
  if (
    input.sanction &&
    !["warning", "content_write_restriction", "suspension", "ban"].includes(
      input.sanction.type,
    )
  )
    throw new ModerationValidationError("제재 유형을 확인해주세요.");
  const report = await repository.findForDecision(reportId, session);
  if (!report) throw new ModerationConflictError("이미 처리된 신고입니다.");
  if (
    input.contentAction &&
    input.contentAction !== "none" &&
    !["content", "comment"].includes(report.targetType)
  )
    throw new ModerationValidationError(
      "이 신고 대상에는 콘텐츠 조치를 적용할 수 없습니다.",
    );
  if (input.sanction && report.targetType !== "user")
    throw new ModerationValidationError("사용자 신고에만 제재할 수 있습니다.");
  const now = new Date().toISOString();
  const resolved = await repository.resolvePending(
    reportId,
    { status: input.status, resolution, resolvedAt: now, resolvedBy: actor.id },
    session,
  );
  if (!resolved) throw new ModerationConflictError("이미 처리된 신고입니다.");
  if (input.contentAction && input.contentAction !== "none")
    await repository.applyContentAction?.(
      reportId,
      input.contentAction,
      resolution,
      session,
    );
  if (input.sanction) {
    const sanctionReason = input.sanction.reason?.trim();
    if (!sanctionReason)
      throw new ModerationValidationError("제재 사유를 입력해주세요.");
    if (
      input.sanction.endsAt &&
      Number.isNaN(Date.parse(input.sanction.endsAt))
    )
      throw new ModerationValidationError("제재 종료일을 확인해주세요.");
    if (input.sanction.type === "ban" && input.sanction.endsAt)
      throw new ModerationValidationError(
        "영구 정지에는 종료일을 지정할 수 없습니다.",
      );
    await repository.createSanction?.(
      {
        id: crypto.randomUUID(),
        reportId,
        type: input.sanction.type,
        reason: sanctionReason,
        ...(input.sanction.endsAt
          ? { endsAt: new Date(input.sanction.endsAt).toISOString() }
          : {}),
        createdAt: now,
        createdBy: actor.id,
      },
      session,
    );
    const status = sanctionAccountStatus(input.sanction.type);
    if (
      status &&
      !(input.sanction.type === "suspension" && input.sanction.endsAt)
    )
      await repository.updateUserStatus?.(
        reportId,
        status,
        sanctionReason,
        session,
      );
  }
  return resolved;
}

function sanctionAccountStatus(type: SanctionType) {
  return type === "suspension"
    ? "suspended"
    : type === "ban"
      ? "deleted"
      : null;
}
function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function softDeleteComment<T extends Record<string, unknown>>(
  comment: T,
  actorId: string,
  reason: string,
) {
  return {
    ...comment,
    isDeleted: true,
    deletedAt: new Date().toISOString(),
    deletedBy: actorId,
    deletionReason: reason.trim(),
    restoreUnavailable: !comment.body || !comment.ownerId,
  };
}

export function publicComment(
  comment: Record<string, unknown>,
): Record<string, unknown> {
  const masked = comment.isDeleted
    ? {
        ...comment,
        body: "삭제된 댓글입니다.",
        author: "알 수 없음",
        authorName: "알 수 없음",
        ownerId: undefined,
        authorAvatarUrl: undefined,
      }
    : { ...comment };
  return {
    ...masked,
    ...(Array.isArray(comment.replies)
      ? {
          replies: comment.replies.map((reply) =>
            publicComment(reply as Record<string, unknown>),
          ),
        }
      : {}),
  };
}
