import { NextResponse, type NextRequest } from "next/server";
import { AdminEventRequestMongoRepository } from "@/infrastructure/mongodb/adminContentMongoRepository";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminRequestId,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const value = await new AdminEventRequestMongoRepository().findRequestById(
    id,
  );
  return value
    ? adminJson(value)
    : adminError(
        "NOT_FOUND",
        "이벤트 요청을 찾을 수 없습니다.",
        404,
        adminRequestId(request),
      );
}
