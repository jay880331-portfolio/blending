import type {
  AdminEventRequestDto,
  AdminEventRequestPage,
  DecideEventRequestInput,
} from "@blending/admin-contracts";
import { useAdminSessionStore } from "../../store/adminSessionStore";
import { adminApi, adminHeaders } from "./adminApi";

export async function fetchEventRequests(query: string) {
  return (
    await adminApi.get<AdminEventRequestPage>(
      `/api/admin/event-requests?${query}`,
    )
  ).data;
}

export async function fetchEventRequest(id: string) {
  return (
    await adminApi.get<AdminEventRequestDto>(
      `/api/admin/event-requests/${encodeURIComponent(id)}`,
    )
  ).data;
}

export async function decideEventRequest(
  id: string,
  input: DecideEventRequestInput,
) {
  return (
    await adminApi.post<AdminEventRequestDto>(
      `/api/admin/event-requests/${encodeURIComponent(id)}/decision`,
      input,
      {
        headers: adminHeaders(
          "POST",
          useAdminSessionStore.getState().csrfToken,
        ),
      },
    )
  ).data;
}
