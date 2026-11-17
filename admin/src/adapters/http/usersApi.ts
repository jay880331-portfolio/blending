import type {
  AdminRelatedItemAction,
  AdminUserCareerDto,
  AdminUserDetailDto,
  AdminUserPage,
  AdminUserRole,
  AdminUserStatus,
  AdminUserDto,
  AdminUserPortfolioDto,
  AdminUserProfileDto,
  AdminUserRelatedKind,
  AdminUserRelatedPage,
  SaveAdminUserCareerInput,
  SaveAdminUserPortfolioInput,
  UpdateAdminUserProfileInput,
  CreateAdminManagedUserInput,
  UpdateAdminManagedUserInput,
} from "@blending/admin-contracts";
import { useAdminSessionStore } from "../../store/adminSessionStore";
import { adminApi, adminHeaders } from "./adminApi";

function mutationHeaders(method: string) {
  return adminHeaders(method, useAdminSessionStore.getState().csrfToken);
}

export async function fetchUsers(query: string) {
  return (await adminApi.get<AdminUserPage>(`/api/admin/users?${query}`)).data;
}
export async function fetchUser(id: string) {
  return (await adminApi.get<AdminUserDetailDto>(`/api/admin/users/${id}`))
    .data;
}
export async function createUser(input: CreateAdminManagedUserInput) {
  return (
    await adminApi.post<AdminUserDto>("/api/admin/users", input, {
      headers: mutationHeaders("POST"),
    })
  ).data;
}
export async function updateUser(
  id: string,
  input: UpdateAdminManagedUserInput,
) {
  await adminApi.patch(`/api/admin/users/${id}`, input, {
    headers: mutationHeaders("PATCH"),
  });
}
export async function changeUserStatus(
  id: string,
  status: AdminUserStatus,
  reason: string,
) {
  await adminApi.patch(
    `/api/admin/users/${id}/status`,
    { status, reason },
    { headers: mutationHeaders("PATCH") },
  );
}
export async function changeUserRole(
  id: string,
  role: AdminUserRole,
  reason: string,
) {
  await adminApi.patch(
    `/api/admin/users/${id}/role`,
    { role, reason },
    { headers: mutationHeaders("PATCH") },
  );
}
export async function deleteUser(id: string, reason: string) {
  await adminApi.delete(`/api/admin/users/${id}`, {
    data: { reason },
    headers: mutationHeaders("DELETE"),
  });
}

export async function fetchUserRelated(
  userId: string,
  kind: AdminUserRelatedKind,
  page = 1,
) {
  return (
    await adminApi.get<AdminUserRelatedPage>(
      `/api/admin/users/${userId}/related?kind=${kind}&page=${page}&pageSize=20`,
    )
  ).data;
}

export async function fetchRelatedMessage(userId: string, itemId: string) {
  return (
    await adminApi.get<{
      item: AdminUserRelatedPage["items"][number];
      auditId: string;
    }>(`/api/admin/users/${userId}/related/messages/${itemId}`)
  ).data;
}

export async function mutateUserRelated(
  userId: string,
  kind: AdminUserRelatedKind,
  itemId: string,
  input: AdminRelatedItemAction | { enabled: boolean; reason: string },
) {
  await adminApi.patch(
    `/api/admin/users/${userId}/related/${kind}/${itemId}`,
    input,
    { headers: mutationHeaders("PATCH") },
  );
}

export async function fetchUserProfile(userId: string) {
  return (
    await adminApi.get<AdminUserProfileDto>(
      `/api/admin/users/${userId}/profile`,
    )
  ).data;
}

export async function updateUserProfile(
  userId: string,
  input: UpdateAdminUserProfileInput,
) {
  await adminApi.put(`/api/admin/users/${userId}/profile`, input, {
    headers: mutationHeaders("PUT"),
  });
}

export async function fetchUserCareers(userId: string) {
  return (
    await adminApi.get<AdminUserCareerDto[]>(
      `/api/admin/users/${userId}/careers`,
    )
  ).data;
}

export async function saveUserCareer(
  userId: string,
  input: SaveAdminUserCareerInput,
  create: boolean,
) {
  const url = create
    ? `/api/admin/users/${userId}/careers`
    : `/api/admin/users/${userId}/careers/${input.id}`;
  const response = create
    ? await adminApi.post<AdminUserCareerDto>(url, input, {
        headers: mutationHeaders("POST"),
      })
    : await adminApi.put<AdminUserCareerDto>(url, input, {
        headers: mutationHeaders("PUT"),
      });
  return response.data;
}

export async function deleteUserCareer(
  userId: string,
  careerId: string,
  reason: string,
) {
  await adminApi.delete(`/api/admin/users/${userId}/careers/${careerId}`, {
    data: { reason },
    headers: mutationHeaders("DELETE"),
  });
}

export async function fetchUserPortfolios(userId: string) {
  return (
    await adminApi.get<AdminUserPortfolioDto[]>(
      `/api/admin/users/${userId}/portfolios`,
    )
  ).data;
}

export async function saveUserPortfolio(
  userId: string,
  input: SaveAdminUserPortfolioInput,
  create: boolean,
) {
  const url = create
    ? `/api/admin/users/${userId}/portfolios`
    : `/api/admin/users/${userId}/portfolios/${input.id}`;
  const response = create
    ? await adminApi.post<AdminUserPortfolioDto>(url, input, {
        headers: mutationHeaders("POST"),
      })
    : await adminApi.put<AdminUserPortfolioDto>(url, input, {
        headers: mutationHeaders("PUT"),
      });
  return response.data;
}

export async function deleteUserPortfolio(
  userId: string,
  portfolioId: string,
  reason: string,
) {
  await adminApi.delete(
    `/api/admin/users/${userId}/portfolios/${portfolioId}`,
    { data: { reason }, headers: mutationHeaders("DELETE") },
  );
}
