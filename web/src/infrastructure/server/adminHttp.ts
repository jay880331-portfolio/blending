import type { AdminApiError } from "@blending/admin-contracts";
import { NextResponse } from "next/server";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export function adminJson<T>(body: T, status = 200) {
  return NextResponse.json<T>(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

export function adminError(
  code: AdminApiError["code"],
  message: string,
  status: number,
  requestId: string,
) {
  return adminJson<AdminApiError>({ code, message, requestId }, status);
}
