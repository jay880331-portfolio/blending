import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeAccountEmail,
  normalizeAccountPhone,
  validateAccountEmail,
  validateAccountPhone,
} from "./accountValidation";

describe("normalizeAccountEmail", () => {
  it("trims and lowercases an account email", () => {
    assert.equal(
      normalizeAccountEmail("  Jay@Example.COM  "),
      "jay@example.com",
    );
  });
});

describe("validateAccountEmail", () => {
  it("requires a valid email address", () => {
    assert.equal(validateAccountEmail(""), "이메일을 입력해주세요.");
    assert.equal(
      validateAccountEmail("jay"),
      "올바른 이메일 형식으로 입력해주세요.",
    );
  });

  it("accepts a normal email address", () => {
    assert.equal(validateAccountEmail("jay@example.com"), null);
  });
});

describe("normalizeAccountPhone", () => {
  it("keeps only digits for account phone numbers", () => {
    assert.equal(normalizeAccountPhone("010-1234-5678"), "01012345678");
  });
});

describe("validateAccountPhone", () => {
  it("requires a usable phone number", () => {
    assert.equal(validateAccountPhone(""), "휴대폰 번호를 입력해주세요.");
    assert.equal(
      validateAccountPhone("010-123"),
      "휴대폰 번호를 정확히 입력해주세요.",
    );
  });

  it("accepts normal phone numbers", () => {
    assert.equal(validateAccountPhone("01012345678"), null);
  });
});
