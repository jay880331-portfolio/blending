import assert from "node:assert/strict";
import { it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BusinessCardActions,
  ProfileBioRow,
  businessCardImageLayout,
  businessCardLogoRect,
} from "./ProfileSwipeCard";

it("renders PDF, share, and close as matching circular icon controls", () => {
  const html = renderToStaticMarkup(
    createElement(BusinessCardActions, {
      onSavePdf: () => undefined,
      onShare: () => undefined,
      onClose: () => undefined,
    }),
  );

  assert.equal(html.match(/business-card-action-button/g)?.length, 3);
  assert.match(html, /aria-label="PDF로 저장"/);
  assert.match(html, /aria-label="명함 공유"/);
  assert.match(html, /aria-label="닫기"/);
  assert.doesNotMatch(html, />PDF 저장</);
  assert.doesNotMatch(html, />공유</);
});

it("centers both card faces side by side in a square share image", () => {
  const layout = businessCardImageLayout();
  assert.deepEqual(layout, {
    cardWidth: 320,
    cardHeight: (320 * 16) / 9,
    gap: 32,
    width: 736,
    height: 736,
    frontX: 32,
    frontY: (736 - (320 * 16) / 9) / 2,
    backX: 384,
    backY: (736 - (320 * 16) / 9) / 2,
  });
});

it("keeps the original logo aspect ratio inside its box", () => {
  const rect = businessCardLogoRect(164, 121);

  assert.equal(rect.width, 106);
  assert.ok(Math.abs(rect.width / rect.height - 164 / 121) < 1e-12);
});

it("lets users expand a truncated bio by tapping the bio row", () => {
  const html = renderToStaticMarkup(
    createElement(ProfileBioRow, {
      bio: "긴 자기소개입니다",
      expanded: false,
      overflows: true,
      isHome: true,
      onToggle: () => undefined,
    }),
  );

  assert.match(html, /<button[^>]*aria-label="자기소개 펼치기"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /긴 자기소개입니다/);
  assert.doesNotMatch(html, /h-6 w-6/);
  assert.doesNotMatch(html, /lucide-chevron/);
});

it("lets users collapse an expanded bio by tapping the bio row", () => {
  const html = renderToStaticMarkup(
    createElement(ProfileBioRow, {
      bio: "긴 자기소개입니다",
      expanded: true,
      overflows: true,
      isHome: true,
      onToggle: () => undefined,
    }),
  );

  assert.match(html, /aria-label="자기소개 접기"/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /whitespace-pre-wrap/);
});

it("does not wrap a short bio in a toggle button", () => {
  const html = renderToStaticMarkup(
    createElement(ProfileBioRow, {
      bio: "짧은 소개",
      expanded: false,
      overflows: false,
      isHome: true,
      onToggle: () => undefined,
    }),
  );

  assert.doesNotMatch(html, /<button/);
  assert.match(html, /짧은 소개/);
});
