import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
import nextConfig from "../../../next.config";
import { MapProfileGroupSheet } from "./MapProfileGroupSheet";

const imageConfig = { ...imageConfigDefault, ...nextConfig.images };

const profiles = [
  {
    id: "one",
    name: "김블렌딩",
    workplace: "블렌딩 커피",
    avatarUrl: "https://k.kakaocdn.net/dn/example/photo.jpg",
    online: true,
    skills: ["브루잉"],
  },
  {
    id: "two",
    name: "박바리스타",
    workplace: "서울 로스터리",
    online: false,
    skills: ["로스팅"],
  },
];

function renderSheet(count: 1 | 2) {
  return renderToStaticMarkup(
    createElement(
      ImageConfigContext.Provider,
      { value: imageConfig },
      createElement(MapProfileGroupSheet, {
        profiles: profiles.slice(0, count),
        onClose: () => undefined,
        onProfileSelect: () => undefined,
      }),
    ),
  );
}

describe("MapProfileGroupSheet", () => {
  it("renders the compact location sheet for one barista", () => {
    const html = renderSheet(1);

    assert.match(html, /이 위치의 바리스타 1명/);
    assert.match(html, /\/_next\/image/);
    assert.doesNotMatch(html, /background-image/);
    assert.match(html, /!h-10 !w-10/);
    assert.match(html, /text-\[15px\] font-bold/);
    assert.match(html, /text-\[13px\]/);
    assert.match(html, /블렌딩 커피 · 브루잉/);
    assert.match(html, />보기</);
  });

  it("renders the same compact row structure for multiple baristas", () => {
    const html = renderSheet(2);

    assert.match(html, /이 위치의 바리스타 2명/);
    assert.equal((html.match(/!h-10 !w-10/g) ?? []).length, 2);
    assert.equal((html.match(/>보기</g) ?? []).length, 2);
    assert.match(html, /김블렌딩/);
    assert.match(html, /박바리스타/);
  });

  it("counts one barista once when duplicate profile IDs share a location", () => {
    const html = renderToStaticMarkup(
      createElement(
        ImageConfigContext.Provider,
        { value: imageConfig },
        createElement(MapProfileGroupSheet, {
          profiles: [
            { ...profiles[0], profileId: "profile-kim" },
            {
              ...profiles[0],
              id: "one-second-workplace",
              profileId: "profile-kim",
            },
            { ...profiles[1], profileId: "profile-park" },
          ],
          onClose: () => undefined,
          onProfileSelect: () => undefined,
        }),
      ),
    );

    assert.match(html, /이 위치의 바리스타 2명/);
    assert.equal((html.match(/>보기</g) ?? []).length, 2);
  });
});
