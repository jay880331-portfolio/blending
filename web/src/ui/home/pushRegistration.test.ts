import assert from "node:assert/strict";
import { it } from "node:test";
import { registerNativePushToken } from "./HomeApp";

it("푸시 토큰이 서버에 저장된 뒤에만 등록 성공을 반환한다", async () => {
  let finishSaving!: () => void;
  const saving = new Promise<void>((resolve) => {
    finishSaving = resolve;
  });
  const registration = registerNativePushToken(
    async () => ({
      granted: true as const,
      canAskAgain: true,
      status: "granted",
      token: "ExpoPushToken[test]",
      platform: "ios" as const,
    }),
    async () => saving,
  );
  let registered = false;
  void registration.then(() => {
    registered = true;
  });

  await Promise.resolve();
  assert.equal(registered, false);

  finishSaving();
  assert.equal(await registration, true);
});
