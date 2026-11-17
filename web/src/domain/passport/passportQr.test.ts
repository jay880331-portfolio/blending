import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePassportQr, passportQrValue } from "./passportQr";

describe("passportQr", () => {
  it("accepts only blending:passport:v1: prefix with 43-char base64url token", () => {
    const token = "a".repeat(43);
    assert.equal(parsePassportQr(passportQrValue(token)), token);

    for (const invalid of [
      token,
      `blending:coupon:v1:${token}`,
      `https://example.com/${token}`,
      passportQrValue(token) + "x",
      passportQrValue("short"),
    ]) {
      assert.equal(parsePassportQr(invalid), null);
    }
  });
});
