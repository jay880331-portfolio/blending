import {
  APP_POPUP_PLACEMENTS,
  type AppPopupPlacement,
} from "@blending/admin-contracts";
import { NextResponse, type NextRequest } from "next/server";
import type { AppPopupQueryRepository } from "@/application/admin/appPopupUseCases";
import { appPopupMongoRepository } from "@/infrastructure/mongodb/appPopupMongoRepository";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError } from "@/infrastructure/server/http";

export type Dependencies = {
  getUser: typeof getCurrentUser;
  repository: AppPopupQueryRepository;
  now: () => string;
};

export const defaultDependencies: Dependencies = {
  getUser: getCurrentUser,
  repository: appPopupMongoRepository,
  now: () => new Date().toISOString(),
};

export async function handleGetAppPopups(
  request: NextRequest,
  dependencies: Dependencies = defaultDependencies,
) {
  const user = await dependencies.getUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const placement = request.nextUrl.searchParams.get("placement");
  if (!APP_POPUP_PLACEMENTS.includes(placement as AppPopupPlacement))
    return jsonError("팝업 구좌를 확인해주세요.", 400);

  try {
    return NextResponse.json(
      await dependencies.repository.listActive(
        placement as AppPopupPlacement,
        dependencies.now(),
      ),
    );
  } catch {
    return jsonError("팝업을 불러오지 못했습니다.", 500);
  }
}
