export type CalendarSwipePoint = {
  x: number;
  y: number;
};

const CALENDAR_SWIPE_THRESHOLD = 45;

export function getCalendarMonthSwipeDelta(
  start: CalendarSwipePoint,
  end: CalendarSwipePoint,
): -1 | 0 | 1 {
  const horizontalDistance = end.x - start.x;
  const verticalDistance = end.y - start.y;

  if (
    Math.abs(horizontalDistance) <= CALENDAR_SWIPE_THRESHOLD ||
    Math.abs(verticalDistance) >= Math.abs(horizontalDistance)
  ) {
    return 0;
  }

  return horizontalDistance > 0 ? -1 : 1;
}
