import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
import nextConfig from "../../../next.config";
import { MapProfileDetailSheet } from "./MapProfileDetailSheet";

const imageConfig = { ...imageConfigDefault, ...nextConfig.images };

function renderHtml(node: ReactElement) {
  return renderToStaticMarkup(
    createElement(ImageConfigContext.Provider, { value: imageConfig }, node),
  );
}

const profile = {
  id: "profile-1",
  profileId: "member-1",
  name: "김블렌딩",
  workplace: "블렌딩 커피",
  address: "서울 용산구",
  avatarUrl: "https://k.kakaocdn.net/dn/example/photo.jpg",
  online: true,
  canMessage: true,
  isOwnProfile: false,
};

describe("MapProfileDetailSheet", () => {
  it("renders profile actions in the compact bottom sheet instead of a floating card", () => {
    const html = renderHtml(
      createElement(MapProfileDetailSheet, {
        favorite: false,
        profile,
        savingFavorite: false,
        onFavoriteToggle: () => undefined,
      }),
    );

    assert.match(html, /inset-x-0 bottom-\[var\(--app-bottom-nav-height\)\]/);
    assert.match(html, /rounded-t-\[var\(--radius-xl\)\]/);
    assert.match(html, /h-1 w-10/);
    assert.match(html, /\/_next\/image/);
    assert.doesNotMatch(html, /background-image/);
    assert.match(html, /!h-10 !w-10/);
    assert.match(html, /text-\[15px\] font-bold/);
    assert.match(html, /text-\[13px\]/);
    assert.match(html, /text-\[12px\]/);
    assert.doesNotMatch(html, /inset-x-5/);
    assert.doesNotMatch(html, /h-14 w-14/);
    assert.match(html, /김블렌딩에게 대화 보내기/);
    assert.match(html, /김블렌딩 공개 프로필 보기/);
    assert.match(html, /즐겨찾기 추가/);
  });
});
