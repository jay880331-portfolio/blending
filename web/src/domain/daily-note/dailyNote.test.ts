import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatDailyNoteTechnical,
  dailyNoteTechnicalEntries,
  decodeDailyNoteCursor,
  mergeDailyNoteFeed,
  normalizeDailyNoteTechnicals,
  removeEmptyFeaturedTechnicalKeys,
  runSingleFlight,
  selectFeaturedTechnicalKey,
  validateDailyNoteInput,
} from "./dailyNote";

test("Daily Note 커서는 빈 ID를 허용하지 않는다", () => {
  const encode = (id: string) =>
    Buffer.from(
      JSON.stringify({ id, createdAt: "2026-08-14T00:00:00.000Z" }),
    ).toString("base64url");

  assert.equal(decodeDailyNoteCursor(encode("")), null);
  assert.equal(decodeDailyNoteCursor(encode("   ")), null);
  assert.deepEqual(decodeDailyNoteCursor(encode("daily-note-1")), {
    id: "daily-note-1",
    createdAt: "2026-08-14T00:00:00.000Z",
  });
});

test("대표 기술값은 두 개까지만 선택되고 값 삭제 시 해제된다", () => {
  assert.deepEqual(
    selectFeaturedTechnicalKey(["beanName", "grinder"], "brixPercent"),
    ["beanName", "grinder"],
  );
  assert.deepEqual(
    removeEmptyFeaturedTechnicalKeys(["beanName", "grinder"], {
      beanName: "에티오피아",
    }),
    ["beanName"],
  );
});

test("기술값 표시와 피드 병합은 단위, 중복 제거, 최신순을 유지한다", () => {
  assert.equal(formatDailyNoteTechnical("waterTemperatureC", 93), "93°C");
  assert.equal(formatDailyNoteTechnical("brixPercent", 8.4), "8.4% BRIX");
  assert.equal(
    formatDailyNoteTechnical("beanName", "에티오피아 ".repeat(20)).length,
    120,
  );
  assert.deepEqual(
    dailyNoteTechnicalEntries({ beanName: "에티오피아", brixPercent: 8.4 }).map(
      (item) => item.key,
    ),
    ["beanName", "brixPercent"],
  );
  assert.deepEqual(
    mergeDailyNoteFeed(
      [
        { id: "old", createdAt: "2026-08-14T09:00:00.000Z" },
        { id: "same", createdAt: "2026-08-14T08:00:00.000Z" },
      ],
      [
        { id: "same", createdAt: "2026-08-14T08:00:00.000Z" },
        { id: "new", createdAt: "2026-08-14T10:00:00.000Z" },
      ],
    ).map((item) => item.id),
    ["new", "old", "same"],
  );
});

test("Daily Note 머신은 저장·대표값·피드·상세 기술값에 포함된다", () => {
  const technicals = normalizeDailyNoteTechnicals({
    machine: "La Marzocco Linea Mini",
    beanName: "에티오피아 구지",
  });

  assert.deepEqual(technicals, {
    machine: "La Marzocco Linea Mini",
    beanName: "에티오피아 구지",
  });
  assert.deepEqual(
    dailyNoteTechnicalEntries(technicals ?? {}).map((item) => item.key),
    ["machine", "beanName"],
  );
  assert.equal(
    formatDailyNoteTechnical("machine", "La Marzocco Linea Mini"),
    "La Marzocco Linea Mini",
  );
  assert.equal(
    validateDailyNoteInput({
      imageUrls: [
        "https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/note.jpg",
      ],
      technicals,
      featuredTechnicalKeys: ["machine"],
    }),
    null,
  );
});

test("Daily Note 입력은 사진과 대표 기술값 관계를 검증한다", () => {
  assert.match(
    validateDailyNoteInput({ imageUrls: [] }) ?? "",
    /사진은 1장 이상/,
  );
  assert.match(
    validateDailyNoteInput({
      imageUrls: [
        "https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/note.jpg",
      ],
      featuredTechnicalKeys: ["beanName"],
      technicals: {},
    }) ?? "",
    /대표 기술값/,
  );
  assert.equal(
    validateDailyNoteInput({
      imageUrls: [
        "https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/note.jpg",
      ],
      technicals: { beanName: "에티오피아" },
      featuredTechnicalKeys: ["beanName"],
    }),
    null,
  );
  assert.equal(
    normalizeDailyNoteTechnicals({ beanName: "원두".repeat(101) }),
    null,
  );
  assert.equal(normalizeDailyNoteTechnicals({ brixPercent: Infinity }), null);
});

test("같은 Daily Note 좋아요 요청은 완료 전 한 번만 실행한다", async () => {
  const pending = new Set<string>();
  let calls = 0;
  let release!: () => void;
  const first = runSingleFlight(pending, "note-1", async () => {
    calls += 1;
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  });

  await Promise.resolve();
  await runSingleFlight(pending, "note-1", async () => {
    calls += 1;
  });
  assert.equal(calls, 1);

  release();
  await first;
  await runSingleFlight(pending, "note-1", async () => {
    calls += 1;
  });
  assert.equal(calls, 2);
});
