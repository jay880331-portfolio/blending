import type { AdminAuditLogDto, AdminPage } from "@blending/admin-contracts";
import { adminApi } from "./adminApi";

export async function fetchAuditLogs(query: string) {
  return (
    await adminApi.get<AdminPage<AdminAuditLogDto>>(
      `/api/admin/audit-logs${query ? `?${query}` : ""}`,
    )
  ).data;
}

export async function fetchAuditLog(id: string) {
  return (
    await adminApi.get<AdminAuditLogDto>(
      `/api/admin/audit-logs/${encodeURIComponent(id)}`,
    )
  ).data;
}
