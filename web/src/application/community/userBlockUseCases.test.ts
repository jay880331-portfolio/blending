import assert from "node:assert/strict";
import test from "node:test";
import { UserBlockValidationError, blockUser } from "./userBlockUseCases";

test("rejects a self block before persistence", async () => {
  let created = false;
  await assert.rejects(
    () =>
      blockUser(
        {
          userExists: async () => true,
          create: async () => {
            created = true;
          },
          remove: async () => {},
        },
        "user-1",
        "user-1",
      ),
    UserBlockValidationError,
  );
  assert.equal(created, false);
});
