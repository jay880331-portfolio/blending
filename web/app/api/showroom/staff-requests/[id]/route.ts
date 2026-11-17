import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import {
  cancelMyStaffRequest,
  decideStaffRequest,
  StaffRequestError,
} from "@/infrastructure/server/staffRequestRepository";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await context.params;
  const body = await readJson<{
    decision?: unknown;
    action?: unknown;
  }>(request);

  try {
    if (body?.action === "cancel") {
      const cancelled = await cancelMyStaffRequest(user.id, id);
      return NextResponse.json({ request: cancelled });
    }
    if (body?.decision === "approve" || body?.decision === "reject") {
      const decided = await decideStaffRequest(user.id, id, body.decision);
      return NextResponse.json({ request: decided });
    }
    return jsonError("유효한 처리 요청이 아닙니다.", 400);
  } catch (error) {
    if (error instanceof StaffRequestError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
