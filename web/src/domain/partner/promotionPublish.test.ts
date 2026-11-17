import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDaysIso,
  formatPublishDate,
  isPdfAttachment,
  periodDaysFromRange,
  promotionPublishState,
  toDateInputValue,
} from "./promotionPublish";

describe("promotion publish helpers", () => {
  it("detects pdf attachments by type or name", () => {
    assert.equal(
      isPdfAttachment({ contentType: "application/pdf", name: "a.bin" }),
      true,
    );
    assert.equal(
      isPdfAttachment({ contentType: "image/jpeg", name: "spec.pdf" }),
      true,
    );
    assert.equal(
      isPdfAttachment({ contentType: "image/jpeg", name: "photo.jpg" }),
      false,
    );
  });

  it("keeps legacy promotions without a schedule visible", () => {
    const createdAt = "2026-01-01T00:00:00.000Z";
    const now = Date.parse("2026-09-04T00:00:00.000Z");
    const state = promotionPublishState({ createdAt }, now);
    assert.equal(state.active, true);
    assert.equal(state.statusLabel, "게시 중");
    assert.equal(state.remainingDays, null);
  });

  it("marks ended promotions inactive", () => {
    const state = promotionPublishState(
      {
        createdAt: "2026-07-01T00:00:00.000Z",
        publishedFrom: "2026-07-01T00:00:00.000Z",
        publishedTo: "2026-07-31T23:59:59.000Z",
      },
      Date.parse("2026-08-01T00:00:00.000Z"),
    );
    assert.equal(state.active, false);
    assert.equal(state.statusLabel, "종료");
  });

  it("maps preset ranges and formats dates", () => {
    const localIso = (
      ymd: string,
      time: "00:00:00" | "12:00:00" | "23:59:59" = "00:00:00",
    ) => new Date(`${ymd}T${time}`).toISOString();

    assert.equal(
      periodDaysFromRange(
        localIso("2026-09-03", "00:00:00"),
        localIso("2026-10-03", "23:59:59"),
      ),
      30,
    );
    assert.equal(
      periodDaysFromRange(
        localIso("2026-09-03", "00:00:00"),
        localIso("2026-09-17", "23:59:59"),
      ),
      14,
    );
    assert.equal(
      periodDaysFromRange(
        localIso("2026-09-03", "00:00:00"),
        localIso("2026-09-10", "23:59:59"),
      ),
      7,
    );
    assert.equal(
      periodDaysFromRange(
        localIso("2026-09-03", "00:00:00"),
        localIso("2026-09-20", "23:59:59"),
      ),
      "custom",
    );
    assert.equal(
      periodDaysFromRange(
        localIso("2026-09-03", "00:00:00"),
        localIso("2026-09-11", "23:59:59"),
      ),
      "custom",
    );
    assert.equal(
      formatPublishDate(localIso("2026-09-03", "12:00:00")),
      "2026.09.03",
    );
    assert.equal(
      toDateInputValue(localIso("2026-09-03", "12:00:00")),
      "2026-09-03",
    );
    assert.equal(
      toDateInputValue(addDaysIso(localIso("2026-09-03", "00:00:00"), 7)),
      "2026-09-10",
    );
  });
});
