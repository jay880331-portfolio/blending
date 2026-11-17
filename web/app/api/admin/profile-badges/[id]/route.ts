import type { NextRequest } from "next/server";
import {
  deleteAdminProfileBadge,
  updateAdminProfileBadge,
} from "@/infrastructure/server/adminProfileBadgeRoutes";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Context) {
  return updateAdminProfileBadge(request, (await params).id);
}

export async function DELETE(request: NextRequest, { params }: Context) {
  return deleteAdminProfileBadge(request, (await params).id);
}
