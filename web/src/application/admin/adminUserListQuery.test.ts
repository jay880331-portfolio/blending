import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAdminUserListQuery } from "./adminUserListQuery";

describe("parseAdminUserListQuery", () => {
  it("accepts only user list allowlists", () => {
    assert.equal(
      parseAdminUserListQuery(
        new URLSearchParams(
          "role=admin&status=active&loginMethod=phone&sort=name",
        ),
      ).role,
      "admin",
    );
    for (const query of [
      "role=root",
      "status=blocked",
      "loginMethod=saml",
      "sort=passwordHash",
      "unknown=1",
    ])
      assert.throws(() => parseAdminUserListQuery(new URLSearchParams(query)));
  });

  it("rejects invalid or reversed dates", () => {
    assert.throws(
      () => parseAdminUserListQuery(new URLSearchParams("from=2026-99-99")),
      /날짜/,
    );
    assert.throws(
      () =>
        parseAdminUserListQuery(
          new URLSearchParams("from=2026-02-02&to=2026-02-01"),
        ),
      /범위/,
    );
  });
});
