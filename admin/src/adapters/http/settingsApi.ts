import type {
  AppVersionPolicy,
  AppVersionPolicyUpdate,
  OperationPolicy,
  OperationPolicyUpdate,
} from "@blending/admin-contracts";
import { useAdminSessionStore } from "../../store/adminSessionStore";
import { adminApi, adminHeaders } from "./adminApi";

function headers() {
  return adminHeaders("PUT", useAdminSessionStore.getState().csrfToken);
}

export async function fetchAppVersionPolicy() {
  return (
    await adminApi.get<AppVersionPolicy>(
      "/api/admin/settings/app-version-policy",
    )
  ).data;
}

export async function updateAppVersionPolicy(input: AppVersionPolicyUpdate) {
  return (
    await adminApi.put<AppVersionPolicy>(
      "/api/admin/settings/app-version-policy",
      input,
      { headers: headers() },
    )
  ).data;
}

export async function fetchOperationPolicy() {
  return (
    await adminApi.get<OperationPolicy>("/api/admin/settings/operation-policy")
  ).data;
}

export async function updateOperationPolicy(input: OperationPolicyUpdate) {
  return (
    await adminApi.put<OperationPolicy>(
      "/api/admin/settings/operation-policy",
      input,
      { headers: headers() },
    )
  ).data;
}
