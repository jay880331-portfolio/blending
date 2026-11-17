import type { NextRequest } from "next/server";
import {
  deleteAdminAppPopup,
  getAdminAppPopup,
  updateAdminAppPopup,
} from "@/infrastructure/server/adminAppPopupRoutes";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  return getAdminAppPopup(request, (await params).id);
}

export async function PUT(request: NextRequest, { params }: Context) {
  return updateAdminAppPopup(request, (await params).id);
}

export async function DELETE(request: NextRequest, { params }: Context) {
  return deleteAdminAppPopup(request, (await params).id);
}
