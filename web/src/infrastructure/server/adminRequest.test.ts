import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import {
  invalidAdminMutationContentTypeRequest,
  isAllowedAdminMutationContentType,
  isAllowedAdminOrigin,
  validateAdminCsrf,
} from "./adminRequest";

const originalAdminOrigin = process.env.ADMIN_ORIGIN;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  restoreEnv("ADMIN_ORIGIN", originalAdminOrigin);
  restoreEnv("NODE_ENV", originalNodeEnv);
});

describe("admin request origin", () => {
  it("requires the exact configured origin", () => {
    process.env.ADMIN_ORIGIN = "https://admin.example.com";

    assert.equal(
      isAllowedAdminOrigin(requestFrom("https://admin.example.com")),
      true,
    );
    assert.equal(
      isAllowedAdminOrigin(requestFrom("https://evil.example.com")),
      false,
    );
    assert.equal(isAllowedAdminOrigin(requestFrom(null)), false);
  });

  it("requires an admin origin in production", () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    delete process.env.ADMIN_ORIGIN;

    assert.throws(
      () => isAllowedAdminOrigin(requestFrom("https://admin.example.com")),
      /ADMIN_ORIGIN environment variable is required/,
    );
  });

  it("rejects a wildcard admin origin", () => {
    process.env.ADMIN_ORIGIN = "*";

    assert.throws(
      () => isAllowedAdminOrigin(requestFrom("https://admin.example.com")),
      /ADMIN_ORIGIN must be an exact origin/,
    );
  });
});

describe("admin request csrf", () => {
  it("requires the session csrf value for mutations", () => {
    const session = { userId: "admin-1", csrfToken: "csrf-1" };

    assert.equal(validateAdminCsrf(requestWithCsrf("csrf-1"), session), true);
    assert.equal(validateAdminCsrf(requestWithCsrf("csrf-2"), session), false);
    assert.equal(validateAdminCsrf(requestWithCsrf(null), session), false);
  });
});

describe("admin mutation content type", () => {
  it("accepts JSON media types and rejects missing or non-JSON media types", () => {
    assert.equal(
      isAllowedAdminMutationContentType(
        requestWithContentType("application/json"),
      ),
      true,
    );
    assert.equal(
      isAllowedAdminMutationContentType(
        requestWithContentType("application/json; charset=utf-8"),
      ),
      true,
    );
    assert.equal(
      isAllowedAdminMutationContentType(requestWithContentType(null)),
      false,
    );
    assert.equal(
      isAllowedAdminMutationContentType(requestWithContentType("text/plain")),
      false,
    );
  });

  it("allows multipart only when the route explicitly opts in", () => {
    const request = requestWithContentType(
      "multipart/form-data; boundary=upload-boundary",
    );

    assert.equal(isAllowedAdminMutationContentType(request), false);
    assert.equal(isAllowedAdminMutationContentType(request, "multipart"), true);
  });

  it("returns a no-store 415 Admin API error for an invalid media type", async () => {
    const request = requestWithContentType("text/plain");

    const response = invalidAdminMutationContentTypeRequest(request, "json");

    assert.equal(response.status, 415);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      code: "INVALID_INPUT",
      message: "application/json 형식이 필요합니다.",
      requestId: "request-content-type-test",
    });
  });
});

function requestFrom(origin: string | null) {
  return new NextRequest("https://api.example.com/api/admin/auth/session", {
    headers: origin ? { origin } : undefined,
  });
}

function requestWithCsrf(csrfToken: string | null) {
  return new NextRequest("https://api.example.com/api/admin/auth/logout", {
    method: "POST",
    headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
  });
}

function requestWithContentType(contentType: string | null) {
  return new NextRequest("https://api.example.com/api/admin/users", {
    method: "POST",
    headers: {
      ...(contentType ? { "content-type": contentType } : {}),
      "x-request-id": "request-content-type-test",
    },
  });
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
