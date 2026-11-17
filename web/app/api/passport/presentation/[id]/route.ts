import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError } from "@/infrastructure/server/http";
import {
  getPassportPresentationStatus,
  PassportError,
} from "@/infrastructure/server/passportRepository";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await context.params;
  try {
    const presentation = await getPassportPresentationStatus(user.id, id);
    return NextResponse.json(
      { presentation },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PassportError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
