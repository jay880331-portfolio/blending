import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { APP_POPUP_PLACEMENTS } from "@blending/admin-contracts";
import {
  fromKstDateTimeLocal,
  parsePopupForm,
  toKstDateTimeLocal,
} from "./popupForm";

const formValues = (
  overrides: Record<string, FormDataEntryValue> = {},
): Record<string, FormDataEntryValue> => ({
  adminTitle: "여름 프로모션",
  imageUrl: "https://cdn.example.com/popup.webp",
  imageAlt: "여름 프로모션 안내",
  href: "/partner/promotions",
  "placement:home": "on",
  priority: "1",
  startsAt: "2026-08-20T09:00",
  endsAt: "2026-08-21T09:00",
  enabled: "on",
  ...overrides,
});

describe("popup form", () => {
  it("converts KST datetime-local values to UTC ISO", () => {
    assert.equal(
      fromKstDateTimeLocal("2026-08-21T00:00"),
      "2026-08-20T15:00:00.000Z",
    );
    assert.equal(
      toKstDateTimeLocal("2026-08-20T15:00:00.000Z"),
      "2026-08-21T00:00",
    );
  });

  it("expands all placements and defaults href to null", () => {
    const input = parsePopupForm(formValues({ allPlacements: "on", href: "" }));
    assert.deepEqual(input.placements, APP_POPUP_PLACEMENTS);
    assert.equal(input.href, null);
  });
});
