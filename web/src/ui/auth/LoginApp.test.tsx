import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  LoginApp,
  RecentLoginIndicator,
  resolveRecentLoginMethod,
} from "./LoginApp";

type LoginMethod = "phone" | "kakao" | "naver" | "apple";

test("서버의 최신 로그인 수단이 휴대폰 캐시보다 우선한다", () => {
  assert.equal(resolveRecentLoginMethod("phone", "naver"), "naver");
});

test("최근 로그인 말풍선은 일치하는 로그인 버튼에만 표시된다", () => {
  const render = (target: LoginMethod) =>
    renderToStaticMarkup(
      createElement(RecentLoginIndicator, { method: "kakao", target }),
    );

  assert.match(render("kakao"), /최근에 로그인했어요/);
  assert.doesNotMatch(render("phone"), /최근에 로그인했어요/);
});

test("네이버 로그인 버튼을 표시한다", () => {
  const markup = renderToStaticMarkup(createElement(LoginApp, { view: [] }));

  assert.match(markup, /aria-label="네이버로 계속하기"/);
});
