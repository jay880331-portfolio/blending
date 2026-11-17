import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { signSession } from "./auth";
import { signAdminSession, verifyAdminSession } from "./adminSession";

const originalAdminAuthSecret = process.env.ADMIN_AUTH_SECRET;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  restoreEnv("ADMIN_AUTH_SECRET", originalAdminAuthSecret);
  restoreEnv("NODE_ENV", originalNodeEnv);
});

describe("admin session", () => {
  it("does not accept a normal web session as an admin session", () => {
    process.env.ADMIN_AUTH_SECRET = "admin-test-secret";

    assert.equal(verifyAdminSession(signSession("user-1")), null);
  });

  it("rejects a tampered admin session", () => {
    process.env.ADMIN_AUTH_SECRET = "admin-test-secret";
    const { token } = signAdminSession("admin-1");
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    assert.equal(verifyAdminSession(tampered), null);
  });

  it("rejects an admin session after eight hours", () => {
    process.env.ADMIN_AUTH_SECRET = "admin-test-secret";
    const originalNow = Date.now;
    const issuedAt = Date.UTC(2026, 0, 1);

    try {
      Date.now = () => issuedAt;
      const { token } = signAdminSession("admin-1");
      Date.now = () => issuedAt + 8 * 60 * 60 * 1000 + 1_000;

      assert.equal(verifyAdminSession(token), null);
    } finally {
      Date.now = originalNow;
    }
  });

  it("requires a dedicated secret in production", () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    delete process.env.ADMIN_AUTH_SECRET;

    assert.throws(
      () => signAdminSession("admin-1"),
      /ADMIN_AUTH_SECRET environment variable is required/,
    );
  });

  it("round-trips the user and csrf values", () => {
    process.env.ADMIN_AUTH_SECRET = "admin-test-secret";
    const { token, csrfToken } = signAdminSession("admin-1");

    assert.deepEqual(verifyAdminSession(token), {
      userId: "admin-1",
      csrfToken,
    });
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
