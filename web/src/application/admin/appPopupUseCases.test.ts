import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AppPopupInputError,
  parseAdminAppPopupInput,
} from "./appPopupUseCases";

const valid = {
  adminTitle: "여름 프로모션",
  imageUrl: "https://cdn.example.com/popup.webp",
  imageAlt: "여름 프로모션 안내",
  href: "/partner/promotions",
  placements: ["home", "partner"],
  priority: 1,
  startsAt: "2026-08-20T00:00:00.000Z",
  endsAt: "2026-08-21T00:00:00.000Z",
  enabled: true,
};

describe("parseAdminAppPopupInput", () => {
  it("accepts a valid popup and removes duplicate placements", () => {
    assert.deepEqual(
      parseAdminAppPopupInput({ ...valid, placements: ["home", "home"] })
        .placements,
      ["home"],
    );
  });

  it("normalizes offset schedule times to UTC ISO strings", () => {
    const popup = parseAdminAppPopupInput({
      ...valid,
      startsAt: "2026-08-20T09:00:00+09:00",
      endsAt: "2026-08-20T10:00:00+09:00",
    });

    assert.equal(popup.startsAt, "2026-08-20T00:00:00.000Z");
    assert.equal(popup.endsAt, "2026-08-20T01:00:00.000Z");
  });

  it("rejects an unsafe URL, empty placements, and reversed dates", () => {
    assert.throws(() =>
      parseAdminAppPopupInput({ ...valid, href: "javascript:alert(1)" }),
    );
    assert.throws(() =>
      parseAdminAppPopupInput({ ...valid, href: "https://%" }),
    );
    assert.throws(() => parseAdminAppPopupInput({ ...valid, placements: [] }));
    assert.throws(() =>
      parseAdminAppPopupInput({ ...valid, endsAt: valid.startsAt }),
    );
  });

  it("rejects external URL-like hrefs", () => {
    for (const href of [
      "/\\evil.example",
      "//evil.example",
      "data:text/html,test",
    ])
      assert.throws(
        () => parseAdminAppPopupInput({ ...valid, href }),
        AppPopupInputError,
      );
  });
});
