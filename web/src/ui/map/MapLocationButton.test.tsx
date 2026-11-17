import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MapLocationButton } from "./MapLocationButton";

describe("MapLocationButton", () => {
  it("renders a 48px borderless surface circle with the reference target icon", () => {
    const html = renderToStaticMarkup(
      createElement(MapLocationButton, {
        activeProfile: false,
        loading: false,
        onClick: () => undefined,
      }),
    );

    assert.match(html, /h-12 w-12/);
    assert.match(html, /rounded-\[var\(--radius-pill\)\]/);
    assert.match(html, /bg-\[var\(--surface\)\]/);
    assert.match(html, /shadow-\[var\(--shadow-modal\)\]/);
    assert.doesNotMatch(html, /border-/);
    assert.match(html, /aria-label="내 위치로 이동"/);
    assert.match(html, /aria-busy="false"/);
    assert.match(html, /width="24" height="24"/);
    assert.match(html, /text-\[var\(--accent\)\]/);
    assert.match(html, /<circle cx="12" cy="12" r="7"><\/circle>/);
    assert.doesNotMatch(html, /r="3"/);
    assert.match(
      html,
      /bottom-\[calc\(var\(--app-bottom-nav-height\)\+16px\)\]/,
    );
  });

  it("disables itself and renders an accent spinner while loading", () => {
    const html = renderToStaticMarkup(
      createElement(MapLocationButton, {
        activeProfile: true,
        loading: true,
        onClick: () => undefined,
      }),
    );

    assert.match(html, /aria-busy="true"/);
    assert.match(html, /disabled=""/);
    assert.match(html, /animate-spin/);
    assert.match(html, /width="24" height="24"/);
    assert.match(html, /text-\[var\(--accent\)\]/);
    assert.match(
      html,
      /bottom-\[calc\(var\(--app-bottom-nav-height\)\+140px\)\]/,
    );
  });
});
