import { NextResponse, type NextRequest } from "next/server";
import { adminJson } from "@/infrastructure/server/adminHttp";
import { requireAdminApiRequest } from "@/infrastructure/server/adminRequest";
import {
  getAdminDashboard,
  parseDashboardRange,
} from "@/application/admin/dashboardUseCase";
import { AdminStatsMongoRepository } from "@/infrastructure/mongodb/adminStatsMongoRepository";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  let range;
  try {
    range = parseDashboardRange(request.nextUrl.searchParams.get("range"));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "조회 기간을 확인해주세요." },
      { status: 400 },
    );
  }
  try {
    const repository = new AdminStatsMongoRepository();
    return adminJson(await getAdminDashboard(repository, range));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "대시보드 조회 실패" },
      { status: 500 },
    );
  }
}
