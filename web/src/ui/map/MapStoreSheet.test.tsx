import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
import nextConfig from "../../../next.config";
import { MapStoreSheet } from "./MapStoreSheet";

const imageConfig = { ...imageConfigDefault, ...nextConfig.images };

describe("MapStoreSheet", () => {
  it("renders store name, notice, active timesale deeplink, favorite button, and baristas", () => {
    const html = renderToStaticMarkup(
      createElement(
        ImageConfigContext.Provider,
        { value: imageConfig },
        createElement(MapStoreSheet, {
          store: {
            id: "showroom-1",
            storeName: "성수 블렌딩",
            address: "서울 성동구 연무장길 12",
            favorited: true,
            tasteProfile: {
              flavors: ["acidity"],
              signatureMenus: ["handdrip"],
              hasDecaf: true,
            },
            statusNotice: {
              text: "오늘 에티오피아 게이샤 드립 가능",
              createdAt: "2026-11-17T01:00:00.000Z",
              expiresAt: "2026-11-17T14:59:59.999Z",
            },
            activeTimesaleCoupons: [
              {
                id: "coupon-9",
                title: "오후 아메리카노 반값",
                discountDetail: "50% 할인",
                validUntil: "2026-11-17T12:00:00.000Z",
              },
            ],
          },
          viewerPassport: {
            flavor: "acidity",
            menus: ["handdrip"],
            decaf: false,
            issuedAt: "2026-11-17T00:00:00.000Z",
          },
          profiles: [
            {
              id: "barista-1",
              profileId: "barista-1",
              name: "김블렌딩",
              workplace: "성수 블렌딩",
              online: true,
              skills: ["브루잉"],
            },
          ],
          savingFavorite: false,
          onClose: () => undefined,
          onFavoriteToggle: () => undefined,
          onProfileSelect: () => undefined,
        }),
      ),
    );

    assert.match(html, /성수 블렌딩/);
    assert.match(html, /오늘 에티오피아 게이샤 드립 가능/);
    assert.match(html, /타임세일/);
    assert.match(html, /\/showroom\/showroom-1\?coupon=coupon-9/);
    assert.match(html, /매장 찜 해제/);
    assert.match(html, /김블렌딩/);
    assert.match(html, /\/showroom\/showroom-1"/);
    assert.match(html, /내 취향과 맞음/);
    assert.match(html, /#산미맛집/);
  });
});
