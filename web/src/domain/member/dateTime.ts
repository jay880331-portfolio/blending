const SEOUL_TIME_ZONE = "Asia/Seoul";

const seoulDateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: SEOUL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatSeoulDateTime(date: Date) {
  const parts = seoulDateTimeFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}.${value("month")}.${value("day")} ${value("hour")}:${value("minute")}`;
}

export function formatRelativeTime(
  value?: string,
  fallback = "방금 전",
  now = new Date(),
) {
  if (!value) return fallback;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return fallback;

  const diffSeconds = Math.max(0, Math.floor((now.getTime() - time) / 1000));
  if (diffSeconds < 60) return "방금 전";

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}분 전`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}일 전`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`;

  return `${Math.floor(diffDays / 365)}년 전`;
}
