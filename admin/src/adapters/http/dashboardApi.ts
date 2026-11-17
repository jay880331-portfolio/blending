import { adminApi } from "./adminApi";
export type DashboardRange = "7d" | "30d" | "90d";
export type AdminDashboardDto = {
  generatedAt: string;
  range: DashboardRange;
  summary: Record<string, number>;
  daily: { date: string; users: number; content: number }[];
  usersByRole: { role: string; count: number }[];
  contentByType: { type: string; count: number }[];
};
export async function fetchDashboard(range: DashboardRange) {
  const r = await adminApi.get<AdminDashboardDto>(
    `/api/admin/dashboard?range=${range}`,
  );
  return r.data;
}
