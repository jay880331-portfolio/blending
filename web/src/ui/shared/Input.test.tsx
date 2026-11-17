import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Input, Select, Textarea } from "./Input";

describe("Input, Textarea, Select semantics", () => {
  it("Input forwards native input attributes and ref", () => {
    const ref = createRef<HTMLInputElement>();
    const html = renderToStaticMarkup(
      <Input
        ref={ref}
        type="tel"
        name="phone"
        placeholder="010-0000-0000"
        autoComplete="tel"
        required
      />,
    );
    assert.match(html, /^<input\b/);
    assert.match(html, /type="tel"/);
    assert.match(html, /name="phone"/);
    assert.match(html, /placeholder="010-0000-0000"/);
    assert.match(html, /autoComplete="tel"/i);
    assert.match(html, /\brequired=""/);
  });

  it("Textarea forwards native textarea attributes and ref", () => {
    const ref = createRef<HTMLTextAreaElement>();
    const html = renderToStaticMarkup(
      <Textarea
        ref={ref}
        name="description"
        rows={5}
        placeholder="설명을 입력하세요"
        defaultValue="초기값"
      />,
    );
    assert.match(html, /^<textarea\b/);
    assert.match(html, /name="description"/);
    assert.match(html, /rows="5"/);
    assert.match(html, />초기값<\/textarea>$/);
  });

  it("Select forwards native select attributes and renders options", () => {
    const ref = createRef<HTMLSelectElement>();
    const html = renderToStaticMarkup(
      <Select ref={ref} name="birth-year" defaultValue="2000">
        <option value="">선택</option>
        <option value="2000">2000</option>
      </Select>,
    );
    assert.match(html, /^<select\b/);
    assert.match(html, /name="birth-year"/);
    assert.match(html, /<option value="2000" selected="">2000<\/option>/);
  });
});
