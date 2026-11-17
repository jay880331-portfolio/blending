import type { AppPopupDto, AppPopupPlacement } from "@blending/admin-contracts";
import axios from "axios";

export async function fetchAppPopups(
  placement: AppPopupPlacement,
  signal?: AbortSignal,
) {
  return (
    await axios.get<AppPopupDto[]>("/api/popups", {
      params: { placement },
      signal,
    })
  ).data;
}
