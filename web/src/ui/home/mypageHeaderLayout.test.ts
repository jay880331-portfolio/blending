import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const globalsSource = readFileSync(
  new URL("../../../app/globals.css", import.meta.url),
  "utf8",
);

test("마이페이지 하위 화면의 공통 헤더는 스크롤과 무관하게 고정된다", () => {
  const source = readFileSync(
    new URL("./HomeApp.tsx", import.meta.url),
    "utf8",
  );
  const header = source.match(
    /function MyPageSubHeader[\s\S]*?\n}\n\nfunction HomeSubHeader/,
  )?.[0];

  assert.ok(header);
  assert.match(header, /fixed inset-x-0 top-0/);
  assert.match(header, /h-\[calc\(64px\+env\(safe-area-inset-top\)\)\]/);
});

test("페이지 진입 애니메이션은 fixed 헤더의 containing block을 남기지 않는다", () => {
  const slidePageRule = globalsSource.match(
    /\.member-slide-page\s*\{[\s\S]*?\}/,
  )?.[0];

  assert.ok(slidePageRule);
  assert.doesNotMatch(slidePageRule, /\bboth\b/);
});
