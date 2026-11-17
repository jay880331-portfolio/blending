import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCalendarEventSegmentLabel,
  formatEventScheduleDisplay,
  eventSchedule,
  formatEventDate,
  formatEventTime,
  minimumEventEnd,
} from "./eventSchedule";

describe("eventSchedule", () => {
  it("formats an event date for display", () => {
    assert.equal(formatEventDate("2026-07-15"), "2026. 07. 15.");
  });

  it("formats event times with Korean AM and PM markers", () => {
    assert.equal(formatEventTime("10:00"), "오전 10:00");
    assert.equal(formatEventTime("13:05"), "오후 1:05");
  });

  it("formats a timed multi-day event with its full date range", () => {
    assert.deepEqual(
      formatEventScheduleDisplay(
        "2026-08-27T10:00:00+09:00",
        "2026-08-30T18:00:00+09:00",
        false,
      ),
      {
        title: "2026.08.27 - 2026.08.30",
        body: "10:00 AM - 6:00 PM",
      },
    );
  });

  it("does not expose an all-day event's exclusive midnight end date", () => {
    assert.deepEqual(
      formatEventScheduleDisplay(
        "2026-08-27T00:00:00+09:00",
        "2026-08-31T00:00:00+09:00",
        true,
      ),
      {
        title: "2026.08.27 - 2026.08.30",
        body: "종일",
      },
    );
  });

  it("uses only the start date when an event ends on the same day or has no end", () => {
    assert.deepEqual(
      formatEventScheduleDisplay(
        "2026-08-27T10:00:00+09:00",
        "2026-08-27T18:00:00+09:00",
        false,
      ),
      { title: "2026.08.27", body: "10:00 AM - 6:00 PM" },
    );
    assert.deepEqual(
      formatEventScheduleDisplay("2026-08-27T10:00:00+09:00", undefined, false),
      { title: "2026.08.27", body: "10:00 AM" },
    );
  });

  it("hides repeated text for a one-day segment continuing from the prior week", () => {
    assert.equal(
      formatCalendarEventSegmentLabel("2026 서울 카페&베이커리페어", true, 1),
      "\u00a0",
    );
  });

  it("repeats the title for a multi-day segment continuing from the prior week", () => {
    assert.equal(
      formatCalendarEventSegmentLabel("2026 서울 카페&베이커리페어", true, 2),
      "2026 서울 카페&베이커리페어",
    );
  });

  it("keeps the title for a segment that starts in the current week", () => {
    assert.equal(
      formatCalendarEventSegmentLabel("2026 서울 카페&베이커리페어", false, 1),
      "2026 서울 카페&베이커리페어",
    );
  });

  it("keeps an end at least one hour after a timed start", () => {
    assert.deepEqual(minimumEventEnd("2026-08-14", "23:30", false), {
      date: "2026-08-15",
      time: "00:30",
    });
  });

  it("uses the following date for all-day events", () => {
    assert.deepEqual(minimumEventEnd("2026-08-14", "12:00", true), {
      date: "2026-08-15",
      time: "00:00",
    });
  });

  it("rejects an end that is not after the start", () => {
    assert.equal(
      eventSchedule("2026-08-14", "10:00", "2026-08-14", "10:00", false)
        .isValid,
      false,
    );
  });
});
