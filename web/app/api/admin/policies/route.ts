import type { NextRequest } from "next/server";
import {
  createGuideContentRoute,
  listGuideContent,
} from "@/infrastructure/server/adminGuideContentRoutes";
export const GET = (request: NextRequest) =>
  listGuideContent(request, "policy");
export const POST = (request: NextRequest) =>
  createGuideContentRoute(request, "policy");
