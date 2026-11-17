import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { BrewGuide } from "@/domain/brewGuide/brewGuide";
import { BrewGuideCardApp } from "./BrewGuideCardApp";

const baseGuide: BrewGuide = {
  id: "guide-1",
  storeId: "store-1",
  beanId: "bean-1",
  title: "에티오피아 예가체프",
  filter: {
    doseG: 18,
    grind: "중간-가늘게",
    waterTempC: 93,
    yieldG: 280,
    timeSec: 150,
  },
  espresso: {
    doseG: 19,
    basketG: 20,
    waterTempC: 92,
    yieldG: 38,
    timeSec: 28,
  },
  createdAt: "2026-11-17T00:00:00.000Z",
  updatedAt: "2026-11-17T00:00:00.000Z",
  storeName: "블렌딩 로스터리",
  authorName: "김바리스타",
  authorHandle: "kimbarista",
  beanActive: true,
};

describe("BrewGuideCardApp", () => {
  it("renders 2 columns, PNG save link, and single accent re-reserve CTA when bean is active", () => {
    const html = renderToStaticMarkup(<BrewGuideCardApp guide={baseGuide} />);
    assert.ok(html.includes("BREW GUIDE"));
    assert.ok(html.includes("FILTER"));
    assert.ok(html.includes("ESPRESSO"));
    assert.ok(html.includes("md:grid-cols-2"));
    assert.ok(html.includes("이미지 저장"));
    assert.ok(html.includes("이 원두 재예약하기"));
    assert.ok(html.includes("/showroom/store-1?tab=beans&amp;bean=bean-1"));
    assert.ok(
      html.includes("/api/brew-guides/guide-1/image?scale=2&amp;download=1"),
    );
    assert.ok(!html.includes("공유"));
  });

  it("expands to 1 column without dash placeholder and hides re-reserve CTA when bean is inactive", () => {
    const html = renderToStaticMarkup(
      <BrewGuideCardApp
        guide={{
          ...baseGuide,
          espresso: undefined,
          beanActive: false,
        }}
      />,
    );
    assert.ok(html.includes("FILTER"));
    assert.ok(!html.includes("ESPRESSO"));
    assert.ok(!html.includes("md:grid-cols-2"));
    assert.ok(!html.includes("—"));
    assert.ok(!html.includes("이 원두 재예약하기"));
  });
});
