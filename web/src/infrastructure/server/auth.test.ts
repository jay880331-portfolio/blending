import assert from "node:assert/strict";
import test from "node:test";
import { LoginInactiveAccountError, recordLoginMetadata } from "./auth";

test("로그인 중 삭제 전환되면 로그인 메타데이터와 최근 로그인은 변경하지 않는다", async () => {
  const lastLoginAt = new Date("2026-08-20T00:00:00.000Z");
  const user = {
    accountStatus: "active",
    lastLoginMethod: "phone",
    lastLoginAt,
  };
  const recent = { userId: "previous-user", method: "kakao" };
  const users = {
    updateOne: async () => {
      user.accountStatus = "deleting";
      return { matchedCount: 0 };
    },
  };
  const recentLogins = {
    updateOne: async () => {
      recent.userId = "user-1";
      recent.method = "phone";
    },
  };

  await assert.rejects(
    recordLoginMetadata(users as never, recentLogins as never, {
      userId: "user-1",
      deviceId: "device-1",
      method: "phone",
      now: new Date("2026-08-21T00:00:00.000Z"),
    }),
    LoginInactiveAccountError,
  );

  assert.deepEqual(user, {
    accountStatus: "deleting",
    lastLoginMethod: "phone",
    lastLoginAt,
  });
  assert.deepEqual(recent, { userId: "previous-user", method: "kakao" });
});
