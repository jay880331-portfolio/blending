import type { AdminListQuery } from "./common";

export const ADMIN_AUDIT_ACTIONS = [
  "auth.login",
  "auth.login_failed",
  "auth.token_revoke",
  "user.create",
  "user.update",
  "user.status_change",
  "user.role_change",
  "content.create",
  "content.update",
  "content.hide",
  "content.delete",
  "content.restore",
  "event_request.approve",
  "event_request.reject",
  "store.business_verification.decide",
  "notification.delete",
  "popup.create",
  "popup.delete",
  "popup.update",
  "popup.toggle",
  "profile_badge.create",
  "profile_badge.update",
  "profile_badge.delete",
  "report.resolve",
  "sanction.apply",
  "sanction.revoke",
  "settings.update",
  "search.reconcile",
  "account_deletion.retry",
  "sensitive.read",
] as const;

export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];

export type AdminAuditLogDto = {
  id: string;
  actorId: string | null;
  actorName: string;
  action: AdminAuditAction;
  resourceType: string;
  resourceId: string;
  reason?: string;
  changedFields: string[];
  requestId: string;
  ip: string;
  userAgent: string;
  createdAt: string;
};

export type NewAdminAuditLog = Omit<AdminAuditLogDto, "id" | "createdAt">;

export type AdminAuditListQuery = AdminListQuery & {
  actorId?: string;
  action?: AdminAuditAction;
  resourceType?: string;
  resourceId?: string;
};
