import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "./Button";
import { AnchorButton, LinkButton } from "./LinkButton";

describe("Button component semantics", () => {
  it("defaults to type='button' and renders native button element", () => {
    const html = renderToStaticMarkup(<Button>클릭</Button>);
    assert.match(html, /^<button\b/);
    assert.match(html, /type="button"/);
    assert.match(html, />클릭<\/button>$/);
  });

  it("preserves explicit type='submit'", () => {
    const html = renderToStaticMarkup(<Button type="submit">제출</Button>);
    assert.match(html, /type="submit"/);
  });

  it("applies disabled attribute when disabled is true", () => {
    const html = renderToStaticMarkup(<Button disabled>비활성</Button>);
    assert.match(html, /\bdisabled=""/);
  });

  it("applies disabled and aria-busy='true' when pending is true", () => {
    const html = renderToStaticMarkup(<Button pending>로딩 중</Button>);
    assert.match(html, /\bdisabled=""/);
    assert.match(html, /aria-busy="true"/);
  });

  it("prevents external aria-busy='false' from overriding when pending is true", () => {
    const html = renderToStaticMarkup(
      <Button pending aria-busy="false">
        로딩 중
      </Button>,
    );
    assert.match(html, /\bdisabled=""/);
    assert.match(html, /aria-busy="true"/);
  });

  it("preserves ref forwarding to button element", () => {
    const ref = createRef<HTMLButtonElement>();
    const element = <Button ref={ref}>Ref 확인</Button>;
    assert.equal(element.props.children, "Ref 확인");
    assert.ok(ref);
  });
});

describe("LinkButton and AnchorButton semantics", () => {
  it("LinkButton renders Next Link anchor with correct href", () => {
    const html = renderToStaticMarkup(
      <LinkButton href="/signup">회원가입</LinkButton>,
    );
    assert.match(html, /^<a\b/);
    assert.match(html, /href="\/signup"/);
    assert.match(html, />회원가입<\/a>$/);
  });

  it("AnchorButton renders native anchor with correct href", () => {
    const html = renderToStaticMarkup(
      <AnchorButton href="https://external.example.com">외부링크</AnchorButton>,
    );
    assert.match(html, /^<a\b/);
    assert.match(html, /href="https:\/\/external\.example\.com"/);
    assert.match(html, />외부링크<\/a>$/);
  });

  it("maintains separate component exports for Link vs native anchor", () => {
    assert.notEqual(LinkButton, AnchorButton);
  });
});
