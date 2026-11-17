import type {
  AdminBusinessVerificationDecisionRequest,
  AdminBusinessVerificationListResponse,
  AdminBusinessVerificationStatus,
} from "@blending/admin-contracts";
import { useAdminSessionStore } from "../../store/adminSessionStore";
import { adminApi, adminHeaders } from "./adminApi";

export async function fetchBusinessVerifications(
  status?: AdminBusinessVerificationStatus,
): Promise<AdminBusinessVerificationListResponse> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return (
    await adminApi.get<AdminBusinessVerificationListResponse>(
      `/api/admin/business-verifications${qs}`,
    )
  ).data;
}

export async function decideBusinessVerification(
  storeId: string,
  input: AdminBusinessVerificationDecisionRequest,
) {
  return (
    await adminApi.post<{
      storeId: string;
      status: AdminBusinessVerificationStatus;
      reviewedAt: string;
      reviewedBy: string;
      rejectReason?: string;
    }>(
      `/api/admin/business-verifications/${encodeURIComponent(storeId)}/decision`,
      input,
      {
        headers: adminHeaders(
          crypto.randomUUID(),
          useAdminSessionStore.getState().csrfToken,
        ),
      },
    )
  ).data;
}
