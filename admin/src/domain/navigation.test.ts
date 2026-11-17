import { strict as assert } from "node:assert";
import { it } from "node:test";
import { adminNavigation, isActiveAdminRoute } from "./navigation";
it("marks only the matching route segment active", () => {
  assert.equal(isActiveAdminRoute("/users/1", "/users"), true);
  assert.equal(isActiveAdminRoute("/users-archive", "/users"), false);
});

it("links the statistics navigation item to the implemented route", () => {
  assert.equal(
    adminNavigation.find(({ label }) => label === "통계")?.href,
    "/statistics",
  );
});
