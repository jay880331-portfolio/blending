import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as dailyNoteApp from "./DailyNoteApp";

const source = readFileSync(
  new URL("./DailyNoteApp.tsx", import.meta.url),
  "utf8",
);

test("Daily Note 크롭은 1:1 터치 전용으로 연다", () => {
  assert.match(source, /\{ fixedAspect: "square", touchOnly: true \}/);
});

test("STORY 작성 화면은 탭과 사진 안내 없이 간결한 제목을 표시한다", () => {
  const writeScreen = source.slice(
    source.indexOf("function DailyNoteWriteScreen"),
  );
  const shell = readFileSync(
    new URL("./CommunityShell.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    writeScreen,
    /<CommunityShell\s+activeTab="daily-note"\s+view=\{view\}\s+hideTabs/,
  );
  assert.match(shell, /hideTabs = false/);
  assert.match(shell, /hideTabs \? null : dailyNoteSide/);
  assert.match(
    writeScreen,
    /<h1[^>]*>\s*\{editId \? "수정하기" : "등록하기"\}\s*<\/h1>/,
  );
  assert.doesNotMatch(
    writeScreen,
    /사진은 1장 이상 10장까지 등록할 수 있어요\./,
  );
});

test("홈에서 연 STORY 등록은 홈 하단 탭을 유지한다", () => {
  const home = readFileSync(
    new URL("../home/HomeApp.tsx", import.meta.url),
    "utf8",
  );
  const shell = readFileSync(
    new URL("./CommunityShell.tsx", import.meta.url),
    "utf8",
  );
  assert.match(home, /href="\/community\/daily-note\/new\?from=home"/);
  assert.match(source, /searchParams\.get\("from"\) === "home"/);
  assert.match(source, /bottomNavActive=\{fromHome \? "home" : "partner"\}/);
  assert.match(
    shell,
    /active=\{bottomNavActive \?\? \(dailyNoteSide \? "partner" : "community"\)\}/,
  );
});

test("STORY 작성·수정에서 기술 입력을 제거하고 기존 기술값은 보존한다", () => {
  assert.doesNotMatch(
    source,
    /기술 입력|대표 기술값|TechnicalInput|technicalsOpen/,
  );
  assert.match(source, /technicals: editNote\?\.technicals \?\? \{\}/);
  assert.match(
    source,
    /featuredTechnicalKeys: editNote\?\.featuredTechnicalKeys \?\? \[\]/,
  );
});

test("Daily Note 다음 페이지 observer는 오류가 있으면 중단한다", () => {
  assert.equal(
    dailyNoteApp.shouldObserveDailyNoteFeed("cursor", false, undefined),
    true,
  );
  assert.equal(
    dailyNoteApp.shouldObserveDailyNoteFeed("cursor", true, undefined),
    false,
  );
  assert.equal(
    dailyNoteApp.shouldObserveDailyNoteFeed("cursor", false, "요청 실패"),
    false,
  );
});

test("Daily Note 수정은 기존·신규 사진을 사용자가 정한 순서로 조립한다", () => {
  const assemble = (
    dailyNoteApp as {
      assembleDailyNoteImageUrls?: (
        images: Array<{ url: string; file?: File }>,
        uploadedImageUrls: string[],
      ) => string[];
    }
  ).assembleDailyNoteImageUrls;

  assert.equal(typeof assemble, "function");
  assert.deepEqual(
    assemble!(
      [
        { url: "https://images.example/existing-first.jpg" },
        { url: "blob:new-image", file: {} as File },
        { url: "https://images.example/existing-last.jpg" },
      ],
      ["https://images.example/uploaded-middle.jpg"],
    ),
    [
      "https://images.example/existing-first.jpg",
      "https://images.example/uploaded-middle.jpg",
      "https://images.example/existing-last.jpg",
    ],
  );
});

test("PICK 탭은 즐겨찾기 기준 안내 문구와 각 글의 실제 좋아요 토글 동작을 제공한다", () => {
  assert.match(source, /즐겨찾기한 사람의 새로운 STORY가 이곳에 표시됩니다\./);
  assert.match(
    source,
    /aria-label=\{note\.liked \? "좋아요 취소" : "좋아요"\}/,
  );
  assert.match(source, /aria-pressed=\{note\.liked\}/);
  assert.match(source, /fill=\{note\.liked \? "currentColor" : "none"\}/);
  assert.doesNotMatch(source, /setNotes\(\(previous\) =>\s*previous\.filter/);
  assert.match(
    source,
    /setNotes\(\(current\) =>\s*current\.map\(\(item\) =>\s*item\.id === note\.id\s*\?\s*\{\s*\.\.\.item,\s*liked:\s*result\.liked,\s*likeCount:\s*result\.likeCount\s*\}\s*:\s*item,\s*\),?\s*\)/,
  );
});
