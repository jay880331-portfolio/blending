import assert from "node:assert/strict";
import { it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  OfficialAvatarBadge,
  OfficialBadgeChip,
  primaryOfficialBadge,
} from "./OfficialBadgeList";

it("picks the first official badge as the avatar label", () => {
  assert.equal(
    primaryOfficialBadge([
      { id: "1", name: "WBC 2021", icon: "award", imageUrl: null },
      { id: "2", name: "WBC 2019", icon: "award", imageUrl: null },
    ])?.name,
    "WBC 2021",
  );
  assert.equal(primaryOfficialBadge([]), null);
});

it("renders every avatar badge with the single reference scale and overlap", () => {
  const html = renderToStaticMarkup(
    createElement(OfficialAvatarBadge, { name: "WBC 2021" }),
  );

  assert.match(html, /WBC 2021/);
  assert.match(html, /bg-\[var\(--accent\)\]/);
  assert.match(html, /inset-x-0/);
  assert.ok(html.includes("top-[calc(100%-7px)]"));
  assert.match(html, /justify-center/);
  assert.match(html, /translateY\(-50%\)/);
  assert.ok(html.includes("h-[18px] text-[10px] leading-[18px]"));
  assert.match(html, /max-w-20/);
  assert.match(html, /shrink-0/);
  assert.doesNotMatch(html, /max-w-\[calc\(100%-8px\)\]/);
  assert.doesNotMatch(html, /left-1 /);
  assert.doesNotMatch(html, /#FFD700|#8B4513|hl-yellow/);
});

it("renders nothing when the avatar has no badge name", () => {
  assert.equal(
    renderToStaticMarkup(createElement(OfficialAvatarBadge, { name: "" })),
    "",
  );
});

it("keeps the text chip fallback when no image is uploaded", () => {
  const html = renderToStaticMarkup(
    createElement(OfficialBadgeChip, {
      badge: { id: "1", name: "본부장", icon: "crown", imageUrl: null },
    }),
  );
  assert.match(html, /본부장/);
});
