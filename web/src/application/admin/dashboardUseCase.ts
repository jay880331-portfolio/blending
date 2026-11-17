import type {
  DashboardRange,
  AdminDashboardDto,
} from "@blending/admin-contracts";

export interface DashboardRepository {
  getDashboard(input: {
    range: DashboardRange;
    now: Date;
    timeZone: string;
  }): Promise<AdminDashboardDto>;
}

export function parseDashboardRange(value: string | null): DashboardRange {
  if (value === null || value === "30d") return "30d";
  if (value === "7d" || value === "90d") return value;
  throw new Error("조회 기간을 확인해주세요.");
}

export async function getAdminDashboard(
  repository: DashboardRepository,
  range: DashboardRange,
  now = new Date(),
): Promise<AdminDashboardDto> {
  return repository.getDashboard({
    range,
    now,
    timeZone: "Asia/Seoul",
  });
}
