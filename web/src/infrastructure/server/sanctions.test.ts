import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isLoginAllowed,
  requireLoginAllowed,
  requireContentWriteAllowed,
} from "./sanctions";

test("blocks content writes during an active write restriction", async () => {
  await assert.rejects(
    () =>
      requireContentWriteAllowed("user-1", {
        activeForUser: async () => ({ type: "content_write_restriction" }),
      }),
    /작성 제한/,
  );
});

test("allows content writes without an active restriction", async () => {
  await requireContentWriteAllowed("user-1", {
    activeForUser: async () => null,
  });
  assert.ok(true);
});

test("denies login before suspension ends and allows it afterwards", async () => {
  let active = true;
  const repository = {
    activeLoginBlockForUser: async () =>
      active ? { type: "suspension" } : null,
  };
  await assert.rejects(() => requireLoginAllowed("user-1", repository), /제재/);
  active = false;
  assert.equal(await isLoginAllowed("user-1", repository), true);
});

test("expired sanctions never clear a later manual suspension", async () => {
  const user = { accountStatus: "suspended" };
  assert.equal(
    await isLoginAllowed("user-1", {
      activeLoginBlockForUser: async () => null,
    }),
    true,
  );
  assert.equal(user.accountStatus, "suspended");
});

test("write restrictions do not block login", async () => {
  assert.equal(
    await isLoginAllowed("user-1", {
      activeLoginBlockForUser: async () => null,
    }),
    true,
  );
});
