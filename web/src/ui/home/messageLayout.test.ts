import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("홈 대화 상세는 목록 헤더 아래에 중첩되지 않는다", () => {
  const source = readFileSync(
    new URL("./HomeApp.tsx", import.meta.url),
    "utf8",
  );
  const homeScreen = source.match(
    /function HomeMessagesScreen[\s\S]*?\n}\n\nfunction NotificationIcon/,
  )?.[0];

  assert.ok(homeScreen);
  assert.doesNotMatch(homeScreen, /<HomeSubHeader/);
});

test("키보드가 변경한 visual viewport에 대화 화면 전체를 맞춘다", () => {
  const source = readFileSync(
    new URL("./HomeApp.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /"--chat-viewport-top"/);
  assert.match(source, /"--chat-viewport-height"/);
  assert.match(source, /top-\[var\(--chat-viewport-top,0px\)\]/);
  assert.match(source, /h-\[var\(--chat-viewport-height,100dvh\)\]/);
  assert.doesNotMatch(source, /--chat-keyboard-offset/);
});

test("대화 상세는 문서가 아닌 메시지 영역만 스크롤한다", () => {
  const source = readFileSync(
    new URL("./HomeApp.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /member-slide-page fixed inset-x-0/);
});

test("보낸 메시지는 읽음 상태를 표시한다", () => {
  const source = readFileSync(
    new URL("./HomeApp.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /sentByMe[\s\S]*?message\.read \? "읽음" : "안읽음"/);
});

test("대화방 진입 시 메시지 끝 기준점으로 이동한다", () => {
  const source = readFileSync(
    new URL("./HomeApp.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /chatEndRef/);
  assert.match(
    source,
    /scrollIntoView\(\{ block: "end", behavior: "auto" \}\)/,
  );
  assert.match(source, /<div ref=\{chatEndRef\} aria-hidden="true" \/>/);
});
