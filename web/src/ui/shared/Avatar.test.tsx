import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
import nextConfig from "../../../next.config";
import { Avatar } from "./Avatar";

const imageConfig = { ...imageConfigDefault, ...nextConfig.images };

function renderHtml(node: ReactNode) {
  return renderToStaticMarkup(
    <ImageConfigContext.Provider value={imageConfig}>
      {node}
    </ImageConfigContext.Provider>,
  );
}

describe("Avatar", () => {
  it("proxies kakao http photos through next/image", () => {
    const html = renderHtml(
      <Avatar src="http://k.kakaocdn.net/dn/example/photo.jpg" />,
    );

    assert.match(html, /\/_next\/image/);
    assert.doesNotMatch(html, /background-image/);
  });

  it("renders the empty placeholder when src is missing", () => {
    const html = renderHtml(<Avatar />);

    assert.doesNotMatch(html, /<img\b/);
    assert.doesNotMatch(html, /\/_next\/image/);
    assert.match(html, /rotate-45/);
    assert.match(html, /-rotate-45/);
  });

  it("applies the accent border when highlighted", () => {
    const html = renderHtml(<Avatar highlighted />);

    assert.match(html, /border-2 border-\[var\(--accent\)\]/);
  });

  it("applies the dashed border when dashed", () => {
    const html = renderHtml(<Avatar dashed />);

    assert.match(html, /border-dashed border-\[var\(--border-strong\)\]/);
  });
});
