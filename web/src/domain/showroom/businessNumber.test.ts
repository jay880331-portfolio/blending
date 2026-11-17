import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatBusinessNumber,
  isValidBusinessNumber,
  normalizeBusinessNumber,
} from "./businessNumber";

describe("businessNumber", () => {
  it("normalizes and formats 10-digit business numbers with hyphens", () => {
    assert.equal(normalizeBusinessNumber("220-81-62517"), "2208162517");
    assert.equal(normalizeBusinessNumber(" 120 81 47521 "), "1208147521");
    assert.equal(normalizeBusinessNumber("123-45-6789"), null);
    assert.equal(normalizeBusinessNumber("123-45-6789a"), null);

    assert.equal(formatBusinessNumber("2208162517"), "220-81-62517");
    assert.equal(formatBusinessNumber("220-81-62517"), "220-81-62517");
    assert.equal(formatBusinessNumber("invalid"), "invalid");
  });

  it("validates NTS checksum correctly", () => {
    assert.equal(isValidBusinessNumber("220-81-62517"), true);
    assert.equal(isValidBusinessNumber("2208162517"), true);
    assert.equal(isValidBusinessNumber("120-81-47521"), true);

    // Invalid last check digit
    assert.equal(isValidBusinessNumber("220-81-62518"), false);
    assert.equal(isValidBusinessNumber("123-45-67890"), false);
    assert.equal(isValidBusinessNumber("000000000"), false);
  });
});
