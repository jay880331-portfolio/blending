import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import { DetailAuthorMeta } from "./DetailAuthorMeta";

test("작성자 메타는 profileHref가 있으면 사진과 이름 전체를 프로필 링크로 만든다", () => {
  const markup = renderToStaticMarkup(
    React.createElement(DetailAuthorMeta, {
      name: "홍길동",
      date: "방금 전",
      profileHref: "/profile/member-1?returnTo=%2Fcommunity%2Freviews%2F1",
    }),
  );

  assert.match(markup, /href="\/profile\/member-1\?returnTo=%2Fcommunity/);
  assert.match(markup, /aria-label="홍길동 프로필 보기"/);
});

test("작성자 메타는 profileHref가 없으면 링크를 렌더하지 않는다", () => {
  const markup = renderToStaticMarkup(
    React.createElement(DetailAuthorMeta, { name: "홍길동", date: "방금 전" }),
  );

  assert.doesNotMatch(markup, /href=/);
});
