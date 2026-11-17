import type { NextRequest } from "next/server";
import { handleGetAppPopups } from "@/infrastructure/server/appPopupRoute";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handleGetAppPopups(request);
}
