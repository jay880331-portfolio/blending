import type { CommunityEvent } from "@/domain/community/types";

export type EventRangeFilter = "all" | "week";

export type WeekEventSegment = {
  event: CommunityEvent;
  startColumn: number;
  span: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

export type PositionedWeekEventSegment = WeekEventSegment & { row: number };

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1_000;

export function parseEventDate(value: string) {
  return new Date(value);
}

function kstDay(value: Date) {
  return Math.floor((value.getTime() + KST_OFFSET_MS) / DAY_MS);
}

function calendarDay(value: Date) {
  return (
    Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / DAY_MS
  );
}

function displayEventEnd(event: CommunityEvent) {
  if (!event.endsAt) return parseEventDate(event.startsAt);
  return new Date(parseEventDate(event.endsAt).getTime() - 1);
}

export function sortEvents(events: CommunityEvent[]) {
  return [...events].sort(
    (a, b) =>
      parseEventDate(a.startsAt).getTime() -
      parseEventDate(b.startsAt).getTime(),
  );
}

export function getEventsOverlappingRange(
  events: CommunityEvent[],
  start: Date,
  end: Date,
) {
  const startDay = calendarDay(start);
  const endDay = calendarDay(end);

  return sortEvents(events).filter((event) => {
    return (
      kstDay(parseEventDate(event.startsAt)) <= endDay &&
      kstDay(displayEventEnd(event)) >= startDay
    );
  });
}

export function getEventsForDate(events: CommunityEvent[], date: Date) {
  return getEventsOverlappingRange(events, date, date);
}

export function getWeekEventSegments(
  events: CommunityEvent[],
  weekStart: Date,
): WeekEventSegment[] {
  const weekStartDay = calendarDay(weekStart);
  const weekEndDay = weekStartDay + 6;

  return sortEvents(events).flatMap((event) => {
    const eventStart = kstDay(parseEventDate(event.startsAt));
    const eventEnd = kstDay(displayEventEnd(event));
    if (eventStart > weekEndDay || eventEnd < weekStartDay) return [];

    const segmentStart = eventStart < weekStartDay ? weekStartDay : eventStart;
    const segmentEnd = eventEnd > weekEndDay ? weekEndDay : eventEnd;
    const startColumn = segmentStart - weekStartDay;
    const span = segmentEnd - segmentStart + 1;

    return [
      {
        event,
        startColumn,
        span,
        continuesBefore: eventStart < weekStartDay,
        continuesAfter: eventEnd > weekEndDay,
      },
    ];
  });
}

export function placeWeekEventSegments(segments: WeekEventSegment[]) {
  const occupied = Array.from({ length: 2 }, () =>
    Array.from({ length: 7 }, () => false),
  );
  const overflowByColumn = Array.from({ length: 7 }, () => 0);
  const positionedSegments: PositionedWeekEventSegment[] = [];

  for (const segment of segments) {
    const row = occupied.findIndex((columns) =>
      columns
        .slice(segment.startColumn, segment.startColumn + segment.span)
        .every((isOccupied) => !isOccupied),
    );
    if (row >= 0)
      occupied[row].fill(
        true,
        segment.startColumn,
        segment.startColumn + segment.span,
      );
    else
      overflowByColumn
        .slice(segment.startColumn, segment.startColumn + segment.span)
        .forEach((_, index) => {
          overflowByColumn[segment.startColumn + index] += 1;
        });
    positionedSegments.push({ ...segment, row });
  }

  return { segments: positionedSegments, overflowByColumn };
}

export function getCalendarWeekStart(today = new Date()) {
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function getUpcomingWeekEvents(
  events: CommunityEvent[],
  today = new Date(),
) {
  const weekStart = getCalendarWeekStart(today);
  const weekEnd = new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() + 6,
    23,
    59,
    59,
    999,
  );
  return getEventsOverlappingRange(events, weekStart, weekEnd);
}

export function filterEventsByRange(
  events: CommunityEvent[],
  range: EventRangeFilter,
  today = new Date(),
) {
  return range === "week"
    ? getUpcomingWeekEvents(events, today)
    : sortEvents(events);
}
