import type {
  AdminCommentPage,
  AdminReportDto,
  AdminReportPage,
  AdminSanctionPage,
  ResolveReportInput,
} from "@blending/admin-contracts";
import { useAdminSessionStore } from "../../store/adminSessionStore";
import { adminApi, adminHeaders } from "./adminApi";
const headers = (method: string) => ({
  headers: adminHeaders(method, useAdminSessionStore.getState().csrfToken),
});
export async function fetchReports(query: string) {
  return (await adminApi.get<AdminReportPage>(`/api/admin/reports?${query}`))
    .data;
}
export async function fetchReport(id: string) {
  return (
    await adminApi.get<AdminReportDto>(
      `/api/admin/reports/${encodeURIComponent(id)}`,
    )
  ).data;
}
export async function decideReport(id: string, input: ResolveReportInput) {
  return (
    await adminApi.patch<AdminReportDto>(
      `/api/admin/reports/${encodeURIComponent(id)}`,
      input,
      headers("PATCH"),
    )
  ).data;
}
export async function fetchSanctions(query: string) {
  return (
    await adminApi.get<AdminSanctionPage>(`/api/admin/sanctions?${query}`)
  ).data;
}
export async function revokeSanction(id: string, reason: string) {
  return (
    await adminApi.patch(
      `/api/admin/sanctions/${encodeURIComponent(id)}`,
      { reason },
      headers("PATCH"),
    )
  ).data;
}
export async function fetchComments(query: string) {
  return (await adminApi.get<AdminCommentPage>(`/api/admin/comments?${query}`))
    .data;
}
export async function deleteComment(
  kind: string,
  parentId: string,
  id: string,
  reason: string,
) {
  return (
    await adminApi.delete(
      `/api/admin/comments/${kind}/${encodeURIComponent(parentId)}/${encodeURIComponent(id)}`,
      { ...headers("DELETE"), data: { reason } },
    )
  ).data;
}
export async function restoreComment(
  kind: string,
  parentId: string,
  id: string,
  reason: string,
) {
  return (
    await adminApi.post(
      `/api/admin/comments/${kind}/${encodeURIComponent(parentId)}/${encodeURIComponent(id)}/restore`,
      { reason },
      headers("POST"),
    )
  ).data;
}
