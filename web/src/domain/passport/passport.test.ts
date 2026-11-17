import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPassportSummary,
  parsePassportInput,
  parseStoreTasteProfile,
} from "./passport";

describe("passport validation and formatting", () => {
  it("parses valid passport input and deduplicates menus", () => {
    const res = parsePassportInput({
      flavor: "acidity",
      menus: ["handdrip", "americano", "handdrip"],
      decaf: true,
    });
    assert.deepEqual(res, {
      ok: true,
      value: {
        flavor: "acidity",
        menus: ["handdrip", "americano"],
        decaf: true,
      },
    });
  });

  it("rejects invalid flavor, empty menus, unknown menus, or non-boolean decaf", () => {
    assert.equal(
      parsePassportInput({ flavor: "bitter", menus: ["latte"], decaf: false })
        .ok,
      false,
    );
    assert.equal(
      parsePassportInput({ flavor: "nutty", menus: [], decaf: false }).ok,
      false,
    );
    assert.equal(
      parsePassportInput({ flavor: "nutty", menus: ["tea"], decaf: false }).ok,
      false,
    );
    assert.equal(
      parsePassportInput({ flavor: "sweet", menus: ["latte"], decaf: "yes" })
        .ok,
      false,
    );
  });

  it("formats a single-line passport summary", () => {
    assert.equal(
      formatPassportSummary({
        flavor: "acidity",
        menus: ["americano", "handdrip"],
        decaf: true,
        issuedAt: "2026-11-17T00:00:00.000Z",
      }),
      "산미 · 아메리카노, 핸드드립 · 디카페인 선호",
    );
    assert.equal(
      formatPassportSummary({
        flavor: "nutty",
        menus: ["latte"],
        decaf: false,
        issuedAt: "2026-11-17T00:00:00.000Z",
      }),
      "고소·묵직 · 카페라떼",
    );
  });

  it("validates store tasteProfile", () => {
    const valid = parseStoreTasteProfile({
      flavors: ["acidity", "sweet", "acidity"],
      signatureMenus: ["handdrip", "espresso"],
      hasDecaf: true,
    });
    assert.deepEqual(valid, {
      ok: true,
      value: {
        flavors: ["acidity", "sweet"],
        signatureMenus: ["handdrip", "espresso"],
        hasDecaf: true,
      },
    });
    assert.equal(
      parseStoreTasteProfile({
        flavors: ["unknown"],
        signatureMenus: [],
        hasDecaf: false,
      }).ok,
      false,
    );
  });
});
