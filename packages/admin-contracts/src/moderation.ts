import type { AdminListQuery, AdminPage } from "./common";

export const REPORT_STATUSES = [
  "open",
  "investigating",
  "resolved",
  "dismissed",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export const REPORT_REASONS = [
  "spam",
  "abuse",
  "privacy",
  "fraud",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const SANCTION_TYPES = [
  "warning",
  "content_write_restriction",
  "suspension",
  "ban",
] as const;
export type SanctionType = (typeof SANCTION_TYPES)[number];
export type ReportTargetType = "user" | "content" | "comment" | "message";

export type CreateReportInput = {
  targetType: ReportTargetType;
  targetId: string;
  parentId?: string;
  reason: ReportReason;
  detail: string;
  blockUserId?: string;
};
export type ResolveReportInput = {
  status: "resolved" | "dismissed";
  resolution: string;
  contentAction?: "none" | "hide" | "delete";
  sanction?: { type: SanctionType; reason: string; endsAt?: string };
};
export type AdminReportDto = CreateReportInput & {
  id: string;
  reporterId: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  resolution?: string;
  resolvedBy?: string;
  targetUserId?: string;
  actionDueAt?: string;
  actionOverdue?: boolean;
  targetSnapshot?: Record<string, unknown>;
};
export type AdminReportListQuery = AdminListQuery & {
  status?: ReportStatus;
  reason?: ReportReason;
  targetType?: ReportTargetType;
};
export type AdminReportPage = AdminPage<AdminReportDto>;
export type AdminSanctionDto = {
  id: string;
  userId: string;
  type: SanctionType;
  reason: string;
  createdAt: string;
  createdBy: string;
  endsAt?: string;
  revokedAt?: string;
  revokedBy?: string;
  revokeReason?: string;
};
export type AdminSanctionListQuery = AdminListQuery & {
  userId?: string;
  type?: SanctionType;
  active?: boolean;
};
export type AdminSanctionPage = AdminPage<AdminSanctionDto>;
export type RevokeSanctionInput = { reason: string };
export type AdminCommentDto = {
  id: string;
  parentKind: "b-talk" | "qa";
  parentId: string;
  parentTitle: string;
  ownerId?: string;
  authorName?: string;
  body: string;
  isDeleted: boolean;
  deletedAt?: string;
  restoreUnavailable: boolean;
};
export type AdminCommentPage = AdminPage<AdminCommentDto>;
