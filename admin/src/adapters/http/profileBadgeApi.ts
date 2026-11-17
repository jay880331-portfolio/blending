import type {
  AdminProfileBadgeDto,
  AdminProfileBadgeInput,
  AdminUserBadgeDto,
} from "@blending/admin-contracts";
import { useAdminSessionStore } from "../../store/adminSessionStore";
import { adminApi, adminHeaders } from "./adminApi";

function mutationHeaders(method: string) {
  return adminHeaders(method, useAdminSessionStore.getState().csrfToken);
}

export const fetchProfileBadges = async () =>
  (await adminApi.get<AdminProfileBadgeDto[]>("/api/admin/profile-badges"))
    .data;

export const createProfileBadge = async (input: AdminProfileBadgeInput) =>
  (
    await adminApi.post<AdminProfileBadgeDto>(
      "/api/admin/profile-badges",
      { badge: input },
      { headers: mutationHeaders("POST") },
    )
  ).data;

export const updateProfileBadge = async (
  id: string,
  input: AdminProfileBadgeInput,
) =>
  (
    await adminApi.put<AdminProfileBadgeDto>(
      `/api/admin/profile-badges/${id}`,
      { badge: input },
      { headers: mutationHeaders("PUT") },
    )
  ).data;

export const deleteProfileBadge = async (id: string) =>
  (
    await adminApi.delete<AdminProfileBadgeDto>(
      `/api/admin/profile-badges/${id}`,
      { headers: mutationHeaders("DELETE") },
    )
  ).data;

export const fetchUserBadges = async (userId: string) =>
  (await adminApi.get<AdminUserBadgeDto[]>(`/api/admin/users/${userId}/badges`))
    .data;

export const assignUserBadge = async (
  userId: string,
  badgeId: string,
  reason: string,
) =>
  (
    await adminApi.post<AdminUserBadgeDto>(
      `/api/admin/users/${userId}/badges`,
      { badgeId, reason },
      { headers: mutationHeaders("POST") },
    )
  ).data;

export const unassignUserBadge = async (
  userId: string,
  badgeId: string,
  reason: string,
) =>
  (
    await adminApi.delete<AdminUserBadgeDto>(
      `/api/admin/users/${userId}/badges/${badgeId}`,
      {
        data: { reason },
        headers: mutationHeaders("DELETE"),
      },
    )
  ).data;
