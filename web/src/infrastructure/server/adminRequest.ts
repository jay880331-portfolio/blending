import { randomUUID, timingSafeEqual } from "node:crypto";
import type {
  AdminAuditAction,
  AdminSession,
  NewAdminAuditLog,
} from "@blending/admin-contracts";
import type { NextRequest } from "next/server";
import { adminError } from "@/infrastructure/server/adminHttp";
import {
  getCurrentAdminSessionUser,
  readAdminSession,
} from "@/infrastructure/server/adminSession";
import { adminClientIp } from "@/infrastructure/server/adminRateLimit";

export function getAdminOrigin() {
  const origin = process.env.ADMIN_ORIGIN;
  if (origin === "*")
    throw new Error("ADMIN_ORIGIN must be an exact origin, not a wildcard.");
  if (origin) return origin;
  if (process.env.NODE_ENV === "production")
    throw new Error("ADMIN_ORIGIN environment variable is required.");
  return "http://localhost:3001";
}

export function isAllowedAdminOrigin(request: NextRequest) {
  return request.headers.get("origin") === getAdminOrigin();
}

export function validateAdminCsrf(request: NextRequest, session: AdminSession) {
  const received = request.headers.get("x-csrf-token");
  if (!received) return false;

  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(session.csrfToken);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export async function requireAdminApiRequest(
  request: NextRequest,
  {
    mutation = false,
    contentType = "json",
  }: { mutation?: boolean; contentType?: "json" | "multipart" } = {},
) {
  if (!isAllowedAdminOrigin(request)) return forbiddenAdminRequest(request);

  const session = readAdminSession(request);
  const admin = session ? await getCurrentAdminSessionUser(request) : null;
  if (!session || !admin) return unauthenticatedAdminRequest(request);
  if (mutation && !isAllowedAdminMutationContentType(request, contentType))
    return invalidAdminMutationContentTypeRequest(request, contentType);
  if (mutation && !validateAdminCsrf(request, session))
    return forbiddenAdminRequest(request);
  return { ok: true as const, admin, session };
}

export function isAllowedAdminMutationContentType(
  request: NextRequest,
  contentType: "json" | "multipart" = "json",
) {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  return (
    mediaType ===
    (contentType === "multipart" ? "multipart/form-data" : "application/json")
  );
}

export function invalidAdminMutationContentTypeRequest(
  request: NextRequest,
  contentType: "json" | "multipart",
) {
  return adminError(
    "INVALID_INPUT",
    contentType === "multipart"
      ? "multipart/form-data 형식이 필요합니다."
      : "application/json 형식이 필요합니다.",
    415,
    adminRequestId(request),
  );
}

export function unauthenticatedAdminRequest(request: NextRequest) {
  return adminError(
    "UNAUTHENTICATED",
    "관리자 로그인이 필요합니다.",
    401,
    adminRequestId(request),
  );
}

export function forbiddenAdminRequest(request: NextRequest) {
  return adminError(
    "FORBIDDEN",
    "요청을 처리할 권한이 없습니다.",
    403,
    adminRequestId(request),
  );
}

export function adminRequestId(request: NextRequest) {
  return request.headers.get("x-request-id") ?? randomUUID();
}

export function adminAuditInput(
  request: NextRequest,
  actor: { id: string; name: string },
  input: {
    action: AdminAuditAction;
    resourceType: string;
    resourceId: string;
    changedFields: string[];
    reason?: string;
  },
): NewAdminAuditLog {
  return {
    actorId: actor.id,
    actorName: actor.name,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    changedFields: input.changedFields,
    ...(input.reason ? { reason: input.reason } : {}),
    requestId: adminRequestId(request),
    ip: adminClientIp(request),
    userAgent: request.headers.get("user-agent") ?? "unknown",
  };
}
