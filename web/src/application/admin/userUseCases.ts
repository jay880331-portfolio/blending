import type {
  AdminRelatedItemAction,
  AdminUserRelatedKind,
  AdminUserRelatedPage,
  AdminUserRelatedQuery,
  AdminUserRole,
  AdminUserStatus,
} from "@blending/admin-contracts";
import type { ClientSession } from "mongodb";
import { isActiveAccount } from "@/infrastructure/server/accountStatus";

export type UserLifecycleRecord = {
  id: string;
  role: AdminUserRole;
  accountStatus?: AdminUserStatus | "deleting";
};

export type UserLifecycleRepository = {
  lockAdminRoleGuard(session: ClientSession): Promise<void>;
  countActiveAdmins(session: ClientSession): Promise<number>;
  findLifecycleById(
    id: string,
    session: ClientSession,
  ): Promise<UserLifecycleRecord | null>;
  updateStatus(
    id: string,
    status: AdminUserStatus,
    reason: string,
    session: ClientSession,
  ): Promise<void>;
  updateRole(
    id: string,
    role: AdminUserRole,
    session: ClientSession,
  ): Promise<void>;
};

const SENSITIVE_USER_FIELDS = new Set([
  "password",
  "passwordHash",
  "providerId",
  "oauthProviderId",
  "expoPushToken",
  "pushRegistrationId",
  "pushToken",
  "sessionId",
  "sessionToken",
  "refreshToken",
  "accessToken",
]);

export function assertNoOwnerOverride(input: object) {
  if (Object.hasOwn(input, "ownerId")) {
    throw new Error("ownerId는 지정할 수 없습니다.");
  }
}

export function assertRelatedActionAllowed(
  kind: AdminUserRelatedKind,
  action: AdminRelatedItemAction["action"],
) {
  const allowed =
    kind === "auth"
      ? action === "revoke"
      : kind === "notifications"
        ? action === "soft-delete"
        : kind !== "settings" &&
          (action === "soft-delete" || action === "restore");
  if (!allowed) throw new Error("지원하지 않는 작업입니다.");
}

export function relatedMutationAudit(
  kind: AdminUserRelatedKind,
  action: AdminRelatedItemAction["action"],
): {
  action:
    | "auth.token_revoke"
    | "notification.delete"
    | "settings.update"
    | "content.delete"
    | "content.restore";
  changedFields: string[];
} {
  if (kind === "auth")
    return {
      action: "auth.token_revoke",
      changedFields: ["disabled", "revokedAt"],
    };
  if (kind === "notifications")
    return { action: "notification.delete", changedFields: [] };
  if (kind === "settings")
    return { action: "settings.update", changedFields: ["enabled"] };
  return {
    action: action === "restore" ? "content.restore" : "content.delete",
    changedFields: ["deletedAt"],
  };
}

export async function getAdminUserDetail<T>(
  userId: string,
  repository: { findDetail(id: string): Promise<T | null> },
): Promise<T | null> {
  const detail = await repository.findDetail(userId);
  return detail === null ? null : (redactUserSecrets(detail) as T);
}

export async function listUserRelated(
  actorId: string,
  userId: string,
  query: AdminUserRelatedQuery,
  repository: {
    listRelated(
      id: string,
      query: AdminUserRelatedQuery,
    ): Promise<AdminUserRelatedPage>;
  },
  auditSensitiveRead: (entry: {
    actorId: string;
    action: "sensitive.read";
    resourceType: string;
    resourceId: string;
  }) => Promise<string>,
) {
  const page = await repository.listRelated(userId, query);
  if (query.kind !== "messages" && query.kind !== "auth") return page;
  const auditId = await auditSensitiveRead({
    actorId,
    action: "sensitive.read",
    resourceType: `user.${query.kind}`,
    resourceId: userId,
  });
  return { ...page, auditId };
}

function redactUserSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactUserSecrets);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      SENSITIVE_USER_FIELDS.has(key) ? [] : [[key, redactUserSecrets(item)]],
    ),
  );
}

export async function changeUserRole(
  input: {
    actorId: string;
    userId: string;
    role: AdminUserRole;
  },
  repository: UserLifecycleRepository,
  session: ClientSession,
) {
  await repository.lockAdminRoleGuard(session);
  const user = await repository.findLifecycleById(input.userId, session);
  if (!user) throw new Error("사용자를 찾을 수 없습니다.");
  assertLifecycleMutable(user);
  if (
    input.actorId === input.userId &&
    user.role === "admin" &&
    input.role !== "admin"
  )
    throw new Error("본인 권한은 변경할 수 없습니다.");
  if (user.role === input.role) return false;
  if (
    user.role === "admin" &&
    isActiveAccount(user) &&
    input.role !== "admin" &&
    (await repository.countActiveAdmins(session)) <= 1
  ) {
    throw new Error("마지막 관리자의 권한은 해제할 수 없습니다.");
  }
  await repository.updateRole(input.userId, input.role, session);
  return true;
}

export async function changeUserStatus(
  input: {
    actorId: string;
    userId: string;
    status: AdminUserStatus;
    reason: string;
  },
  repository: UserLifecycleRepository,
  session: ClientSession,
) {
  if (input.actorId === input.userId && input.status !== "active") {
    throw new Error("본인 상태는 변경할 수 없습니다.");
  }

  await repository.lockAdminRoleGuard(session);
  const user = await repository.findLifecycleById(input.userId, session);
  if (!user) throw new Error("사용자를 찾을 수 없습니다.");
  assertLifecycleMutable(user);
  if (user.accountStatus === input.status) return false;
  if (
    user.role === "admin" &&
    isActiveAccount(user) &&
    input.status !== "active" &&
    (await repository.countActiveAdmins(session)) <= 1
  ) {
    throw new Error("마지막 관리자의 상태는 변경할 수 없습니다.");
  }
  await repository.updateStatus(
    input.userId,
    input.status,
    input.reason,
    session,
  );
  return true;
}

function assertLifecycleMutable(user: UserLifecycleRecord) {
  if (user.accountStatus === "deleting")
    throw new Error("탈퇴 처리 중인 계정은 변경할 수 없습니다.");
}
