import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { listStoreBrewGuides } from "@/infrastructure/server/brewGuideRepository";
import { jsonError } from "@/infrastructure/server/http";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await context.params;
  const guides = await listStoreBrewGuides(id);
  return NextResponse.json({ guides });
}
