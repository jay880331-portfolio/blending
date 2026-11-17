import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { renderBrewGuideImageResponse } from "@/infrastructure/server/brewGuideImage";
import { getBrewGuideById } from "@/infrastructure/server/brewGuideRepository";
import { jsonError } from "@/infrastructure/server/http";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await context.params;
  const guide = await getBrewGuideById(id);
  if (!guide) {
    return jsonError("브루 가이드를 찾을 수 없습니다.", 404);
  }

  const scale = request.nextUrl.searchParams.get("scale") === "2" ? 2 : 1;
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
  const showroomUrl = new URL(
    `/showroom/${encodeURIComponent(guide.storeId)}`,
    origin,
  ).toString();

  const response = await renderBrewGuideImageResponse(guide, {
    showroomUrl,
    scale,
  });

  if (request.nextUrl.searchParams.get("download") === "1") {
    response.headers.set(
      "Content-Disposition",
      `attachment; filename="brew-guide-${guide.id}.png"`,
    );
  }
  return response;
}
