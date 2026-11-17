import type { NextRequest } from "next/server";
import {
  assignAdminUserBadge,
  getAdminUserBadges,
} from "@/infrastructure/server/adminProfileBadgeRoutes";

type Context = { params: Promise<{ userId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  return getAdminUserBadges(request, (await params).userId);
}

export async function POST(request: NextRequest, { params }: Context) {
  return assignAdminUserBadge(request, (await params).userId);
}
