import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adminClientIp,
  createAdminLoginRateLimiter,
  deriveAdminLoginKey,
} from "./adminRateLimit";

type Attempt = {
  key: string;
  failures: number;
  expiresAt: Date;
};

describe("admin login rate limit", () => {
  it("locks a login key after five failures in fifteen minutes", async () => {
    const attempts = new Map<string, Attempt>();
    const limiter = createAdminLoginRateLimiter({
      async find(key) {
        return attempts.get(key) ?? null;
      },
      async increment(key, _now, expiresAt) {
        const existing = attempts.get(key);
        attempts.set(key, {
          key,
          failures: (existing?.failures ?? 0) + 1,
          expiresAt: existing?.expiresAt ?? expiresAt,
        });
      },
      async clear(key) {
        attempts.delete(key);
      },
    });
    const now = new Date("2026-01-01T00:00:00.000Z");

    for (let index = 0; index < 5; index += 1) {
      await limiter.recordFailure("key", now);
    }

    assert.equal(await limiter.isBlocked("key", now), true);
    assert.equal(
      await limiter.isBlocked(
        "key",
        new Date(now.getTime() + 15 * 60 * 1_000 + 1),
      ),
      false,
    );
  });

  it("clears failures after a successful login", async () => {
    const attempts = new Map<string, Attempt>();
    const limiter = createAdminLoginRateLimiter({
      async find(key) {
        return attempts.get(key) ?? null;
      },
      async increment(key, _now, expiresAt) {
        attempts.set(key, {
          key,
          failures: (attempts.get(key)?.failures ?? 0) + 1,
          expiresAt: attempts.get(key)?.expiresAt ?? expiresAt,
        });
      },
      async clear(key) {
        attempts.delete(key);
      },
    });
    const now = new Date("2026-01-01T00:00:00.000Z");

    await limiter.recordFailure("key", now);
    await limiter.clear("key");

    assert.equal(await limiter.isBlocked("key", now), false);
  });

  it("derives an opaque key from the normalized phone and client ip", () => {
    const first = deriveAdminLoginKey(
      "203.0.113.10",
      "010-1234-5678",
      "rate-limit-secret",
    );
    const second = deriveAdminLoginKey(
      "203.0.113.10",
      "01012345678",
      "rate-limit-secret",
    );

    assert.equal(first, second);
    assert.equal(first.includes("01012345678"), false);
    assert.equal(first.includes("203.0.113.10"), false);
  });

  it("does not let spoofed forwarding headers select another bucket", () => {
    const firstRequest = new Request(
      "https://api.example.com/api/admin/auth/login",
      {
        headers: {
          "x-forwarded-for": "203.0.113.10",
          "x-real-ip": "203.0.113.11",
        },
      },
    );
    const secondRequest = new Request(
      "https://api.example.com/api/admin/auth/login",
      {
        headers: {
          "x-forwarded-for": "198.51.100.20",
          "x-real-ip": "198.51.100.21",
        },
      },
    );

    assert.equal(adminClientIp(firstRequest), "unknown");
    assert.equal(adminClientIp(secondRequest), "unknown");
    assert.equal(
      deriveAdminLoginKey(adminClientIp(firstRequest), "01012345678", "secret"),
      deriveAdminLoginKey(
        adminClientIp(secondRequest),
        "01012345678",
        "secret",
      ),
    );
  });

  it("uses the runtime request ip instead of forwarding headers", () => {
    const request = new Request(
      "https://api.example.com/api/admin/auth/login",
      {
        headers: {
          "x-forwarded-for": "203.0.113.10",
          "x-real-ip": "203.0.113.11",
        },
      },
    );
    Object.defineProperty(request, "ip", { value: "192.0.2.30" });

    assert.equal(adminClientIp(request), "192.0.2.30");
  });
});
