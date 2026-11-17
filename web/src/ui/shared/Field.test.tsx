import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FieldLabel, PartnerField } from "./Field";

describe("FieldLabel semantics", () => {
  it("renders span with children and forwards ref", () => {
    const ref = createRef<HTMLSpanElement>();
    const html = renderToStaticMarkup(
      <FieldLabel ref={ref}>라벨 텍스트</FieldLabel>,
    );
    assert.match(html, /^<span\b/);
    assert.match(html, />라벨 텍스트<\/span>$/);
  });

  it("differentiates profile variant from standard", () => {
    const standardHtml = renderToStaticMarkup(
      <FieldLabel variant="standard">표준 라벨</FieldLabel>,
    );
    const profileHtml = renderToStaticMarkup(
      <FieldLabel variant="profile">프로필 라벨</FieldLabel>,
    );
    assert.notEqual(standardHtml, profileHtml);
    assert.match(standardHtml, />표준 라벨<\/span>/);
    assert.match(profileHtml, />프로필 라벨<\/span>/);
  });
});

describe("PartnerField semantics", () => {
  it("renders native label wrapper containing label text, hint, and children", () => {
    const ref = createRef<HTMLLabelElement>();
    const html = renderToStaticMarkup(
      <PartnerField ref={ref} label="업체명 *" hint="필수 입력">
        <input name="company" />
      </PartnerField>,
    );
    assert.match(html, /^<label\b/);
    assert.match(html, /<span>업체명 \*<\/span>/);
    assert.match(html, />필수 입력<\/span>/);
    assert.match(html, /<input name="company"\/>/);
    assert.match(html, /<\/label>$/);
  });
});
