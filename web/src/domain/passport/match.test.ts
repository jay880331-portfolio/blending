import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchStoreTags, storeMatchesTagFilters } from "./match";
import type { CoffeePassport, StoreTasteProfile } from "./passport";

const passport: CoffeePassport = {
  flavor: "acidity",
  menus: ["handdrip", "americano"],
  decaf: true,
  issuedAt: "2026-11-17T00:00:00.000Z",
};

const storeTaste: StoreTasteProfile = {
  flavors: ["acidity", "nutty"],
  signatureMenus: ["handdrip"],
  hasDecaf: true,
};

describe("passport store matching", () => {
  it("returns matched false when passport or tasteProfile is missing", () => {
    assert.deepEqual(matchStoreTags(null, storeTaste), {
      matched: false,
      tags: ["#산미맛집", "#고소다크", "#디카페인", "#핸드드립"],
      reasons: [],
    });
    assert.deepEqual(matchStoreTags(passport, undefined), {
      matched: false,
      tags: [],
      reasons: [],
    });
  });

  it("matches overlapping flavor, menu, and decaf preferences", () => {
    const res = matchStoreTags(passport, storeTaste);
    assert.equal(res.matched, true);
    assert.deepEqual(res.reasons, ["산미", "핸드드립", "디카페인 선호"]);
  });

  it("returns matched false when no preferences overlap", () => {
    const res = matchStoreTags(
      {
        flavor: "sweet",
        menus: ["espresso"],
        decaf: false,
        issuedAt: "2026-11-17T00:00:00.000Z",
      },
      storeTaste,
    );
    assert.equal(res.matched, false);
    assert.deepEqual(res.reasons, []);
  });

  it("filters stores by selected passport map tags", () => {
    assert.equal(storeMatchesTagFilters(undefined, []), true);
    assert.equal(storeMatchesTagFilters(undefined, ["acidity"]), false);
    assert.equal(
      storeMatchesTagFilters(storeTaste, ["acidity", "decaf", "handdrip"]),
      true,
    );
    assert.equal(
      storeMatchesTagFilters(
        { flavors: ["nutty"], signatureMenus: ["latte"], hasDecaf: false },
        ["acidity"],
      ),
      false,
    );
    assert.equal(storeMatchesTagFilters(undefined, ["beans"], true), true);
    assert.equal(storeMatchesTagFilters(undefined, ["beans"], false), false);
  });
});
