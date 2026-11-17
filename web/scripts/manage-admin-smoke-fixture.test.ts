import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  manageAdminSmokeFixture,
  parseSmokeFixtureAction,
} from "./manage-admin-smoke-fixture";

describe("Admin smoke fixture guard", () => {
  it("accepts exactly one action", () => {
    assert.equal(parseSmokeFixtureAction(["--create"]), "create");
    assert.equal(parseSmokeFixtureAction(["--remove"]), "remove");
    assert.throws(() => parseSmokeFixtureAction([]));
    assert.throws(() => parseSmokeFixtureAction(["--create", "--remove"]));
  });

  it("refuses access unless explicitly enabled", async () => {
    const previous = process.env.ADMIN_SMOKE_ENABLED;
    delete process.env.ADMIN_SMOKE_ENABLED;
    await assert.rejects(
      manageAdminSmokeFixture("remove"),
      /ADMIN_SMOKE_ENABLED=true/,
    );
    if (previous === undefined) delete process.env.ADMIN_SMOKE_ENABLED;
    else process.env.ADMIN_SMOKE_ENABLED = previous;
  });
});
