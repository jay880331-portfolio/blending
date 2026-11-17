import type { NextRequest } from "next/server";
import {
  createGuideContentRoute,
  listGuideContent,
} from "@/infrastructure/server/adminGuideContentRoutes";
export const GET = (request: NextRequest) =>
  listGuideContent(request, "notice");
export const POST = (request: NextRequest) =>
  createGuideContentRoute(request, "notice");
