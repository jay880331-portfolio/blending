import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatRelativeTime, formatSeoulDateTime } from "./dateTime";

describe("formatSeoulDateTime", () => {
  it("formats UTC dates in Korea time", () => {
    assert.equal(
      formatSeoulDateTime(new Date("2026-06-12T03:05:00.000Z")),
      "2026.06.12 12:05",
    );
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-06-25T12:00:00.000Z");

  it("keeps hour labels until 23 hours and 59 minutes", () => {
    assert.equal(
      formatRelativeTime("2026-06-24T12:01:00.000Z", "방금 전", now),
      "23시간 전",
    );
  });

  it("uses day and month labels from 24 hours onward", () => {
    assert.equal(
      formatRelativeTime("2026-06-24T12:00:00.000Z", "방금 전", now),
      "1일 전",
    );
    assert.equal(
      formatRelativeTime("2026-06-23T12:00:00.000Z", "방금 전", now),
      "2일 전",
    );
    assert.equal(
      formatRelativeTime("2026-05-26T12:00:00.000Z", "방금 전", now),
      "1개월 전",
    );
  });
});
