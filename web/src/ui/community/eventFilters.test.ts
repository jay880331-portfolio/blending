import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CommunityEvent } from "@/domain/community/types";
import {
  filterEventsByRange,
  getEventsForDate,
  getUpcomingWeekEvents,
  getWeekEventSegments,
  placeWeekEventSegments,
} from "./eventFilters";

function event(
  id: string,
  startsAt: string,
  endsAt?: string,
  allDay?: boolean,
): CommunityEvent {
  return {
    id,
    title: id,
    category: "official",
    startsAt,
    endsAt,
    allDay,
    location: "장소 미정",
    address: "",
    imageUrl: "",
    posterUrl: "",
    description: "",
  };
}

function calendarDate(year: number, month: number, day: number) {
  return new Date(year, month - 1, day);
}

describe("getUpcomingWeekEvents", () => {
  const today = new Date(2026, 5, 10, 15, 3, 0);
  const events = [
    event("past", "2026-05-29T13:38:00+09:00"),
    event("earlier-this-week", "2026-06-08T10:00:00+09:00"),
    event(
      "today-all-day",
      "2026-06-10T00:00:00+09:00",
      "2026-06-11T00:00:00+09:00",
      true,
    ),
    event("later-this-week", "2026-06-12T10:00:00+09:00"),
    event("next-week", "2026-06-15T10:00:00+09:00"),
    event(
      "spans-into-week",
      "2026-06-05T10:00:00+09:00",
      "2026-06-08T17:00:00+09:00",
    ),
  ];

  it("keeps events that overlap the calendar week, including ones that already started", () => {
    assert.deepEqual(
      getUpcomingWeekEvents(events, today).map((item) => item.id),
      [
        "spans-into-week",
        "earlier-this-week",
        "today-all-day",
        "later-this-week",
      ],
    );
  });

  it("uses the same week window when a week range is requested", () => {
    assert.deepEqual(
      filterEventsByRange(events, "week", today).map((item) => item.id),
      [
        "spans-into-week",
        "earlier-this-week",
        "today-all-day",
        "later-this-week",
      ],
    );
  });
});

describe("getEventsForDate", () => {
  const events = [
    event("single-day", "2026-06-11T10:00:00+09:00"),
    event(
      "multi-day",
      "2026-06-10T10:00:00+09:00",
      "2026-06-12T17:00:00+09:00",
    ),
  ];

  it("includes single-day and multi-day events on an overlapping local date", () => {
    assert.deepEqual(
      getEventsForDate(events, calendarDate(2026, 6, 11))
        .map((item) => item.id)
        .sort(),
      ["multi-day", "single-day"],
    );
  });

  it("excludes events outside the local date", () => {
    assert.deepEqual(
      getEventsForDate(events, calendarDate(2026, 6, 13)).map(
        (item) => item.id,
      ),
      [],
    );
  });
});

describe("getWeekEventSegments", () => {
  it("한 주 안의 다일 일정을 하나의 연속 구간으로 계산한다", () => {
    assert.deepEqual(
      getWeekEventSegments(
        [
          event(
            "event-1",
            "2026-08-25T10:00:00+09:00",
            "2026-08-27T17:00:00+09:00",
          ),
        ],
        calendarDate(2026, 8, 23),
      ).map(({ event, ...segment }) => ({ eventId: event.id, ...segment })),
      [
        {
          eventId: "event-1",
          startColumn: 2,
          span: 3,
          continuesBefore: false,
          continuesAfter: false,
        },
      ],
    );
  });

  it("주 경계 일정은 다음 주에도 이어지는 구간으로 계산한다", () => {
    const events = [
      event(
        "event-1",
        "2026-08-28T10:00:00+09:00",
        "2026-09-01T17:00:00+09:00",
      ),
    ];

    assert.deepEqual(
      getWeekEventSegments(events, calendarDate(2026, 8, 23)).map(
        ({ event, ...segment }) => ({ eventId: event.id, ...segment }),
      ),
      [
        {
          eventId: "event-1",
          startColumn: 5,
          span: 2,
          continuesBefore: false,
          continuesAfter: true,
        },
      ],
    );
    assert.deepEqual(
      getWeekEventSegments(events, calendarDate(2026, 8, 30)).map(
        ({ event, ...segment }) => ({ eventId: event.id, ...segment }),
      ),
      [
        {
          eventId: "event-1",
          startColumn: 0,
          span: 3,
          continuesBefore: true,
          continuesAfter: false,
        },
      ],
    );
  });

  it("월 spillover와 단일 일정도 주 범위에서 계산한다", () => {
    assert.deepEqual(
      getWeekEventSegments(
        [
          event(
            "spillover",
            "2026-07-30T10:00:00+09:00",
            "2026-08-02T17:00:00+09:00",
          ),
          event("single", "2026-08-01T10:00:00+09:00"),
        ],
        calendarDate(2026, 7, 26),
      ).map(({ event, ...segment }) => ({ eventId: event.id, ...segment })),
      [
        {
          eventId: "spillover",
          startColumn: 4,
          span: 3,
          continuesBefore: false,
          continuesAfter: true,
        },
        {
          eventId: "single",
          startColumn: 6,
          span: 1,
          continuesBefore: false,
          continuesAfter: false,
        },
      ],
    );
  });
});

describe("일정 종료 시각", () => {
  const weekStart = calendarDate(2026, 8, 23);

  it("다음 날 00:00에 끝나는 단일 종일 일정은 하루만 표시한다", () => {
    const events = [
      event(
        "all-day",
        "2026-08-24T00:00:00+09:00",
        "2026-08-25T00:00:00+09:00",
        true,
      ),
    ];

    assert.equal(getWeekEventSegments(events, weekStart)[0]?.span, 1);
    assert.deepEqual(getEventsForDate(events, calendarDate(2026, 8, 25)), []);
  });

  it("다음 날 00:00에 끝나는 여러 날 종일 일정은 종료일을 제외한다", () => {
    const events = [
      event(
        "all-day-range",
        "2026-08-24T00:00:00+09:00",
        "2026-08-27T00:00:00+09:00",
        true,
      ),
    ];

    assert.equal(getWeekEventSegments(events, weekStart)[0]?.span, 3);
    assert.deepEqual(getEventsForDate(events, calendarDate(2026, 8, 27)), []);
  });

  it("자정에 끝나는 시간제 일정도 종료일에 표시하지 않는다", () => {
    const events = [
      event(
        "midnight",
        "2026-08-24T22:00:00+09:00",
        "2026-08-25T00:00:00+09:00",
      ),
    ];

    assert.equal(getWeekEventSegments(events, weekStart)[0]?.span, 1);
    assert.deepEqual(getEventsForDate(events, calendarDate(2026, 8, 25)), []);
  });
});

describe("placeWeekEventSegments", () => {
  it("두 행에 배치되지 못한 연속 일정도 각 날짜의 overflow에 포함한다", () => {
    const layout = placeWeekEventSegments(
      getWeekEventSegments(
        [
          event("single", "2026-08-24T10:00:00+09:00"),
          event(
            "range-a",
            "2026-08-24T10:00:00+09:00",
            "2026-08-26T17:00:00+09:00",
          ),
          event(
            "range-b",
            "2026-08-24T10:00:00+09:00",
            "2026-08-26T17:00:00+09:00",
          ),
        ],
        calendarDate(2026, 8, 23),
      ),
    );

    assert.deepEqual(
      layout.segments.map(({ event, row }) => ({ eventId: event.id, row })),
      [
        { eventId: "single", row: 0 },
        { eventId: "range-a", row: 1 },
        { eventId: "range-b", row: -1 },
      ],
    );
    assert.deepEqual(layout.overflowByColumn, [0, 1, 1, 1, 0, 0, 0]);
  });
});
