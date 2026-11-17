import type {
  AdminAppPopupDto,
  AdminAppPopupInput,
} from "@blending/admin-contracts";
import { useAdminSessionStore } from "../../store/adminSessionStore";
import { adminApi, adminHeaders } from "./adminApi";

function mutationHeaders(method: string) {
  return adminHeaders(method, useAdminSessionStore.getState().csrfToken);
}

export const fetchAppPopups = async () =>
  (await adminApi.get<AdminAppPopupDto[]>("/api/admin/popups")).data;

export const fetchAppPopup = async (id: string) =>
  (await adminApi.get<AdminAppPopupDto>(`/api/admin/popups/${id}`)).data;

export const createAppPopup = async (input: AdminAppPopupInput) =>
  (
    await adminApi.post<AdminAppPopupDto>(
      "/api/admin/popups",
      { popup: input },
      {
        headers: mutationHeaders("POST"),
      },
    )
  ).data;

export const updateAppPopup = async (id: string, input: AdminAppPopupInput) =>
  (
    await adminApi.put<AdminAppPopupDto>(
      `/api/admin/popups/${id}`,
      { popup: input },
      {
        headers: mutationHeaders("PUT"),
      },
    )
  ).data;

export const deleteAppPopup = async (id: string) =>
  (
    await adminApi.delete<AdminAppPopupDto>(`/api/admin/popups/${id}`, {
      headers: mutationHeaders("DELETE"),
    })
  ).data;

export const setAppPopupEnabled = async (id: string, enabled: boolean) =>
  (
    await adminApi.patch<AdminAppPopupDto>(
      `/api/admin/popups/${id}/enabled`,
      { enabled },
      { headers: mutationHeaders("PATCH") },
    )
  ).data;
