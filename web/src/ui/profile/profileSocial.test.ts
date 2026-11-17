import assert from "node:assert/strict";
import { it } from "node:test";
import { profileSocialHref } from "./profileSocial";

it("builds safe external links for profile social fields", () => {
  assert.equal(
    profileSocialHref("@blending", "instagram"),
    "https://instagram.com/blending",
  );
  assert.equal(
    profileSocialHref("blending", "threads"),
    "https://threads.net/blending",
  );
  assert.equal(
    profileSocialHref("blending.kr", "website"),
    "https://blending.kr",
  );
  assert.equal(
    profileSocialHref("https://blending.kr/recipe", "recipe"),
    "https://blending.kr/recipe",
  );
});
