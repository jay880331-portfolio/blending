import assert from "node:assert/strict";
import test from "node:test";
import { verifyAppleIdentityToken } from "./appleAuthentication";

test("Apple identity token은 검증된 nonce와 subject를 요구한다", async () => {
  const verify = async () => ({
    sub: "apple-user",
    email: "relay@privaterelay.appleid.com",
    nonce: "expected-nonce",
  });

  await assert.rejects(
    verifyAppleIdentityToken(
      "token",
      "com.blending.app",
      "other-nonce",
      verify,
    ),
    /nonce/,
  );
  await assert.doesNotReject(
    verifyAppleIdentityToken(
      "token",
      "com.blending.app",
      "expected-nonce",
      verify,
    ),
  );
});

test("Apple identity token은 누락되거나 빈 subject를 거절한다", async () => {
  for (const sub of [undefined, ""]) {
    await assert.rejects(
      verifyAppleIdentityToken(
        "token",
        "com.blending.app",
        "expected-nonce",
        async () => ({ nonce: "expected-nonce", sub }),
      ),
      /subject/,
    );
  }
});
