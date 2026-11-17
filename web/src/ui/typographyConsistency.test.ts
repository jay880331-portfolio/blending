import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homeSource = readFileSync(
  new URL("./home/HomeApp.tsx", import.meta.url),
  "utf8",
);
const communitySource = readFileSync(
  new URL("./community/CommunityApp.tsx", import.meta.url),
  "utf8",
);
test("마이페이지 하위 헤더는 18px 제목 크기를 사용한다", () => {
  const myPageHeader = homeSource.match(
    /function MyPageSubHeader[\s\S]*?\n}\n\nfunction HomeSubHeader/,
  )?.[0];

  assert.ok(myPageHeader);
  assert.match(myPageHeader, /<h1 className="[^"]*text-\[18px\][^"]*">/);
});

test("마이페이지 메뉴 항목은 B-TALK 게시글 제목과 같은 글자 크기를 사용한다", () => {
  const myPageMenuClass = homeSource.match(
    /const myPageMenuItemClass =\s*"[^"]+"/,
  )?.[0];
  const recipeCard = communitySource.match(
    /function RecipeCard[\s\S]*?<h2 className="[^"]*">/,
  )?.[0];

  assert.ok(myPageMenuClass);
  assert.ok(recipeCard);
  assert.match(myPageMenuClass, /text-\[16px\]/);
  assert.match(recipeCard, /text-\[16px\]/);
});

test("마이페이지 메뉴 그룹 제목은 메뉴 항목과 같은 글자 크기를 사용한다", () => {
  assert.match(
    homeSource,
    /<h2 className="[^"]*text-\[16px\][^"]*">\s*\{group\.title\}/,
  );
});

test("캘린더 연월은 이번 주 일정과 같은 글자 크기를 사용한다", () => {
  const calendarHeading = communitySource.match(
    /<h1 className="[^"]*">\s*\{calendarMonth\.getFullYear\(\)}년/,
  )?.[0];
  const sectionHeader = communitySource.match(
    /function SectionHeader[\s\S]*?<h2 className="[^"]*">/,
  )?.[0];

  assert.ok(calendarHeading);
  assert.ok(sectionHeader);
  assert.match(calendarHeading, /text-\[17px\]/);
  assert.match(calendarHeading, /font-bold/);
  assert.match(calendarHeading, /tracking-\[0\.16em\]/);
  assert.match(sectionHeader, /text-\[17px\]/);
  assert.match(sectionHeader, /font-bold/);
  assert.match(sectionHeader, /tracking-\[0\.16em\]/);
});

test("B-TALK과 Q&A 메타 텍스트는 글자가 잘리지 않는 줄 높이를 사용한다", () => {
  const qaRowMeta = communitySource.match(
    /function QaRowMeta[\s\S]*?function LikeMeta/,
  )?.[0];
  const rootClass = qaRowMeta?.match(/<div className="([^"]+)"/)?.[1];

  assert.ok(rootClass);
  assert.match(rootClass, /leading-\[1\.5\]/);
  assert.doesNotMatch(rootClass, /leading-none/);
});
