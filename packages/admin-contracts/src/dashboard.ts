export type DashboardRange = "7d" | "30d" | "90d";
export type AdminDashboardDto = {
  generatedAt: string;
  range: DashboardRange;
  summary: {
    totalUsers: number;
    newUsers: number;
    recentlyActiveUsers: number;
    activeContent: number;
    newContent: number;
    likes: number;
    openReports: number;
  };
  daily: { date: string; users: number; content: number }[];
  usersByRole: { role: string; count: number }[];
  contentByType: { type: string; count: number }[];
};
