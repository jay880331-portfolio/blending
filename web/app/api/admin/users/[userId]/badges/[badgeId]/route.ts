import type { NextRequest } from "next/server";
import { unassignAdminUserBadge } from "@/infrastructure/server/adminProfileBadgeRoutes";

type Context = { params: Promise<{ userId: string; badgeId: string }> };

export async function DELETE(request: NextRequest, { params }: Context) {
  const { userId, badgeId } = await params;
  return unassignAdminUserBadge(request, userId, badgeId);
}
