import type { AdminLogoutResponse } from "@blending/admin-contracts";
import { NextResponse, type NextRequest } from "next/server";
import { adminJson } from "@/infrastructure/server/adminHttp";
import { requireAdminApiRequest } from "@/infrastructure/server/adminRequest";
import { clearAdminSessionCookie } from "@/infrastructure/server/adminSession";

export async function POST(request: NextRequest) {
  const authorization = await requireAdminApiRequest(request, {
    mutation: true,
  });
  if (authorization instanceof NextResponse) return authorization;

  const response = adminJson<AdminLogoutResponse>({ success: true });
  clearAdminSessionCookie(response);
  return response;
}
