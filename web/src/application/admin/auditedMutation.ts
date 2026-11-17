import type { NewAdminAuditLog } from "@blending/admin-contracts";
import type { ClientSession } from "mongodb";
import type { AdminAuditRepository, AdminUnitOfWork } from "./adminUnitOfWork";

const SENSITIVE_FIELD_LEAVES = new Set([
  "credential",
  "credentials",
  "csrf",
  "csrftoken",
  "clientsecret",
  "expopushtoken",
  "oauthproviderid",
  "password",
  "passwordhash",
  "providerid",
  "pushregistrationid",
  "pushtoken",
  "refreshtoken",
  "secret",
  "sessioncookie",
  "sessionid",
  "sessiontoken",
  "token",
  "accesstoken",
]);

export function assertSafeAuditFields(fields: readonly string[]): void {
  const sensitiveField = fields.find((field) => {
    const normalizedPath = field.replaceAll(/[_-]/g, "").toLowerCase();
    const leaf = normalizedPath.split(".").at(-1) ?? normalizedPath;
    return SENSITIVE_FIELD_LEAVES.has(leaf);
  });

  if (sensitiveField) {
    throw new Error(
      `민감한 필드는 감사 로그에 기록할 수 없습니다: ${sensitiveField}`,
    );
  }
}

export async function runAuditedMutation<T>(
  unitOfWork: AdminUnitOfWork,
  auditRepository: AdminAuditRepository,
  audit: NewAdminAuditLog | ((result: T) => NewAdminAuditLog),
  mutate: (session: ClientSession) => Promise<T>,
  shouldAudit: (result: T) => boolean = () => true,
): Promise<T> {
  if (typeof audit !== "function") assertSafeAuditFields(audit.changedFields);

  return unitOfWork.run(async (session) => {
    const result = await mutate(session);
    if (shouldAudit(result)) {
      const resolvedAudit = typeof audit === "function" ? audit(result) : audit;
      assertSafeAuditFields(resolvedAudit.changedFields);
      await auditRepository.append(resolvedAudit, session);
    }
    return result;
  });
}
