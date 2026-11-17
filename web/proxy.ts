import { NextResponse, type NextRequest } from "next/server";
import {
  operationGuardResponse,
  operationSwitchForPublicMutation,
} from "@/infrastructure/server/operationPolicy";

const ADMIN_CORS_HEADERS = {
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-CSRF-Token",
  Vary: "Origin",
} as const;

export async function proxy(request: NextRequest) {
  const feature = operationSwitchForPublicMutation(
    request.method,
    request.nextUrl.pathname,
  );
  if (feature) {
    const blocked = await operationGuardResponse(feature);
    if (blocked) return blocked;
  }

  if (!request.nextUrl.pathname.startsWith("/api/admin/"))
    return NextResponse.next();

  const allowedOrigin = getAdminOrigin();
  if (request.headers.get("origin") !== allowedOrigin) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const response =
    request.method === "OPTIONS"
      ? new NextResponse(null, { status: 204 })
      : NextResponse.next();
  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  for (const [name, value] of Object.entries(ADMIN_CORS_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}

function getAdminOrigin() {
  const origin = process.env.ADMIN_ORIGIN;
  if (origin === "*")
    throw new Error("ADMIN_ORIGIN must be an exact origin, not a wildcard.");
  if (origin) return origin;
  if (process.env.NODE_ENV === "production")
    throw new Error("ADMIN_ORIGIN environment variable is required.");
  return "http://localhost:3001";
}

export const config = {
  matcher: [
    "/api/admin/:path*",
    "/api/community/:path*",
    "/api/partner/:path*",
  ],
};
