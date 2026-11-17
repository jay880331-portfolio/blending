type EventDateTime = {
  date: string;
  time: string;
};

export function formatEventDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return `${value.replaceAll("-", ". ")}.`;
}

export function formatEventTime(value: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return value;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return value;

  return `${hour < 12 ? "오전" : "오후"} ${hour % 12 || 12}:${match[2]}`;
}

function scheduleDate(value: Date): string {
  return dateTimeInSeoul(value).date.replaceAll("-", ".");
}

function scheduleTime(value: Date): string {
  return value.toLocaleTimeString("en-US", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatEventScheduleDisplay(
  startsAt: string,
  endsAt: string | undefined,
  allDay: boolean,
) {
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : undefined;
  const displayEnd = end && allDay ? new Date(end.getTime() - 1) : end;
  const startDate = scheduleDate(start);
  const endDate = displayEnd ? scheduleDate(displayEnd) : undefined;

  return {
    title:
      endDate && startDate !== endDate
        ? `${startDate} - ${endDate}`
        : startDate,
    body: allDay
      ? "종일"
      : `${scheduleTime(start)}${end ? ` - ${scheduleTime(end)}` : ""}`,
  };
}

export function formatCalendarEventSegmentLabel(
  title: string,
  continuesBefore: boolean,
  span: number,
) {
  return continuesBefore && span === 1 ? "\u00a0" : title;
}

function eventDateTime(date: string, time: string, allDay: boolean) {
  return new Date(`${date}T${allDay ? "00:00" : time}:00+09:00`);
}

function dateTimeInSeoul(value: Date): EventDateTime {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

export function minimumEventEnd(date: string, time: string, allDay: boolean) {
  const value = eventDateTime(date, time, allDay);
  value.setUTCHours(value.getUTCHours() + (allDay ? 24 : 1));
  return dateTimeInSeoul(value);
}

export function eventSchedule(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
  allDay: boolean,
) {
  const startsAt = eventDateTime(startDate, startTime, allDay);
  const endsAt = eventDateTime(endDate, endTime, allDay);

  return {
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    isValid: startsAt < endsAt,
  };
}
