import type {
  AdminAuditListQuery,
  AdminAuditLogDto,
  AdminPage,
} from "@blending/admin-contracts";
import type { AdminAuditRepository } from "./adminUnitOfWork";

export function listAdminAuditLogs(
  repository: AdminAuditRepository,
  query: AdminAuditListQuery,
): Promise<AdminPage<AdminAuditLogDto>> {
  return repository.list(query);
}

export async function getAdminAuditLog(
  repository: AdminAuditRepository,
  id: string,
): Promise<AdminAuditLogDto> {
  const auditLog = await repository.findById(id);
  if (!auditLog) {
    throw new Error("감사 로그를 찾을 수 없습니다.");
  }
  return auditLog;
}
