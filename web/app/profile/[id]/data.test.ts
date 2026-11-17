import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizePublicProfile } from "./data";

describe("sanitizePublicProfile", () => {
  const baseProfile = {
    id: "profile-1",
    name: "김블렌딩",
    passport: {
      flavor: "acidity",
      menus: ["handdrip"],
      decaf: true,
      issuedAt: "2026-11-17T00:00:00.000Z",
    },
  };

  it("removes passport when viewed by another user", () => {
    const sanitized = sanitizePublicProfile(baseProfile, false);
    assert.equal(
      Object.prototype.hasOwnProperty.call(sanitized, "passport"),
      false,
    );
    assert.equal(sanitized.name, "김블렌딩");
  });

  it("preserves passport when viewed by the owner", () => {
    const own = sanitizePublicProfile(baseProfile, true);
    assert.deepEqual(own.passport, baseProfile.passport);
  });
});
