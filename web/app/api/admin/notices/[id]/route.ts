import type { NextRequest } from "next/server";
import {
  changeDeletedGuideContentRoute,
  getGuideContent,
  updateGuideContentRoute,
} from "@/infrastructure/server/adminGuideContentRoutes";
type Context = { params: Promise<{ id: string }> };
export const GET = async (request: NextRequest, { params }: Context) =>
  getGuideContent(request, "notice", (await params).id);
export const PUT = async (request: NextRequest, { params }: Context) =>
  updateGuideContentRoute(request, "notice", (await params).id);
export const DELETE = async (request: NextRequest, { params }: Context) =>
  changeDeletedGuideContentRoute(request, "notice", (await params).id, true);
