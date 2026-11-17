import {
  EVENT_REQUEST_STATUSES,
  type EventRequestStatus,
} from "@blending/admin-contracts";
import { NextResponse, type NextRequest } from "next/server";
import { parseAdminListQuery } from "@/application/admin/adminListQuery";
import { AdminEventRequestMongoRepository } from "@/infrastructure/mongodb/adminContentMongoRepository";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminRequestId,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const params = request.nextUrl.searchParams;
    for (const key of params.keys())
      if (!["q", "status", "direction", "page", "pageSize"].includes(key))
        throw new Error();
    const status = params.get("status");
    if (
      status &&
      !EVENT_REQUEST_STATUSES.includes(status as EventRequestStatus)
    )
      throw new Error();
    const query = parseAdminListQuery(params, []);
    return adminJson(
      await new AdminEventRequestMongoRepository().list({
        ...query,
        status: status ? (status as EventRequestStatus) : undefined,
      }),
    );
  } catch {
    return adminError(
      "INVALID_INPUT",
      "조회 조건을 확인해주세요.",
      400,
      adminRequestId(request),
    );
  }
}
