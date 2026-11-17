import type { NextRequest } from "next/server";
import { toggleAdminAppPopup } from "@/infrastructure/server/adminAppPopupRoutes";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return toggleAdminAppPopup(request, (await params).id);
}
