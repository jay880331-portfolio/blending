import type { AdminSessionResponse } from "@blending/admin-contracts";
import { NextResponse, type NextRequest } from "next/server";
import { adminJson } from "@/infrastructure/server/adminHttp";
import { requireAdminApiRequest } from "@/infrastructure/server/adminRequest";

export async function GET(request: NextRequest) {
  const authorization = await requireAdminApiRequest(request);
  if (authorization instanceof NextResponse) return authorization;

  return adminJson<AdminSessionResponse>({
    authenticated: true,
    user: {
      id: authorization.admin.id,
      name: authorization.admin.name,
      role: "admin",
    },
    csrfToken: authorization.session.csrfToken,
  });
}
