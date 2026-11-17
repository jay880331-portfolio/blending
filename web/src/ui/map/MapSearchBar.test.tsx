import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MapSearchBar } from "./MapSearchBar";

describe("MapSearchBar", () => {
  it("renders the compact pill search field and accessible directory button", () => {
    const html = renderToStaticMarkup(
      createElement(MapSearchBar, {
        filteredCount: 12,
        searchQuery: "",
        onDirectoryOpen: () => undefined,
        onSearchQueryChange: () => undefined,
      }),
    );

    assert.match(
      html,
      /flex h-12 items-center.*rounded-\[var\(--radius-pill\)\].*bg-\[var\(--surface\)\].*px-4.*shadow-\[var\(--shadow-card\)\]/,
    );
    assert.doesNotMatch(html, /border-/);
    assert.match(html, /h-5 w-5/);
    assert.match(html, /<form/);
    assert.match(html, /role="search"/);
    assert.match(html, /placeholder="카페 또는 바리스타 검색"/);
    assert.match(html, /text-\[15px\]/);
    assert.match(html, /aria-label="카페 또는 바리스타 검색"/);
    assert.match(html, /aria-label="검색 결과 12명 목록 열기"/);
    assert.match(html, /type="submit"/);
    assert.match(html, /flex h-11 w-11.*rounded-\[var\(--radius-pill\)\]/);
    assert.match(html, /flex h-9 w-9.*bg-\[var\(--accent-soft\)\]/);
    assert.match(html, /h-5 w-5.*text-\[var\(--accent\)\]/);
  });
});
