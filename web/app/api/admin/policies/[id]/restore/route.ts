import type { NextRequest } from "next/server";
import { changeDeletedGuideContentRoute } from "@/infrastructure/server/adminGuideContentRoutes";
type Context = { params: Promise<{ id: string }> };
export const POST = async (request: NextRequest, { params }: Context) =>
  changeDeletedGuideContentRoute(request, "policy", (await params).id, false);
