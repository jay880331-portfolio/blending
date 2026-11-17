import type {
  SearchIndexHealthDto,
  SearchIndexRunDto,
} from "@blending/admin-contracts";
import { useAdminSessionStore } from "../../store/adminSessionStore";
import { adminApi, adminHeaders } from "./adminApi";

export async function fetchSearchIndexHealth() {
  return (await adminApi.get<SearchIndexHealthDto>("/api/admin/search-index"))
    .data;
}

export async function reconcileSearchIndex() {
  return (
    await adminApi.post<SearchIndexRunDto>(
      "/api/admin/search-index",
      undefined,
      {
        headers: adminHeaders(
          "POST",
          useAdminSessionStore.getState().csrfToken,
        ),
      },
    )
  ).data;
}
