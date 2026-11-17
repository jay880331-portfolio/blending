import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PassportApp } from "./PassportApp";

describe("PassportApp", () => {
  it("renders 3 chip sections and primary issue button when not issued", () => {
    const html = renderToStaticMarkup(
      createElement(PassportApp, { initialPassport: null }),
    );

    assert.match(html, /산미/);
    assert.match(html, /고소·묵직/);
    assert.match(html, /단맛·밸런스/);
    assert.match(html, /아메리카노/);
    assert.match(html, /카페라떼/);
    assert.match(html, /핸드드립/);
    assert.match(html, /에스프레소/);
    assert.match(html, /디카페인 선호/);
    assert.match(html, /여권 발급/);
    assert.doesNotMatch(html, /스탬프|포인트/);
  });

  it("renders passport summary card, stamp CTA, balance, and history when issued", () => {
    const html = renderToStaticMarkup(
      createElement(PassportApp, {
        initialPassport: {
          flavor: "acidity",
          menus: ["handdrip"],
          decaf: true,
          issuedAt: "2026-11-17T00:00:00.000Z",
        },
      }),
    );

    assert.match(html, /내 커피 여권/);
    assert.match(html, /산미/);
    assert.match(html, /핸드드립/);
    assert.match(html, /디카페인 선호/);
    assert.match(html, /수정/);
    assert.match(html, /스탬프 받기/);
    assert.match(html, /보유 포인트/);
    assert.match(html, /스탬프 찍은 매장/);
    assert.match(html, /포인트 내역/);
  });
});
