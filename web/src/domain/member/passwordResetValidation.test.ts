import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validatePasswordResetDraft } from "./passwordResetValidation";

describe("validatePasswordResetDraft", () => {
  it("requires a phone verification token", () => {
    assert.equal(
      validatePasswordResetDraft({
        verificationToken: "",
        password: "password123",
        passwordConfirm: "password123",
      }),
      "휴대폰 인증을 먼저 완료해주세요.",
    );
  });

  it("requires a password with at least 8 characters", () => {
    assert.equal(
      validatePasswordResetDraft({
        verificationToken: "token",
        password: "short",
        passwordConfirm: "short",
      }),
      "새 비밀번호는 8자리 이상이어야 합니다.",
    );
  });

  it("requires matching passwords", () => {
    assert.equal(
      validatePasswordResetDraft({
        verificationToken: "token",
        password: "password123",
        passwordConfirm: "password456",
      }),
      "새 비밀번호가 일치하지 않습니다.",
    );
  });

  it("accepts a verified matching password", () => {
    assert.equal(
      validatePasswordResetDraft({
        verificationToken: "token",
        password: "password123",
        passwordConfirm: "password123",
      }),
      null,
    );
  });
});
