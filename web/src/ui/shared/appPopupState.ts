import type { AppPopupPlacement } from "@blending/admin-contracts";

export const APP_POPUP_HIDDEN_DATE_KEY = "blending:app-popups:hidden-date";
export const APP_POPUP_SESSION_CLOSED_KEY = "blending:app-popups:closed";

export function popupPlacementForPath(
  pathname: string,
): AppPopupPlacement | null {
  if (isAppPopupFormPath(pathname)) return null;
  if (
    matchesPathSegment(pathname, "/map") ||
    matchesPathSegment(pathname, "/profile")
  )
    return "map";
  if (matchesPathSegment(pathname, "/community")) return "community";
  if (matchesPathSegment(pathname, "/home")) return "home";
  if (matchesPathSegment(pathname, "/partner")) return "partner";
  if (matchesPathSegment(pathname, "/mypage")) return "mypage";
  return null;
}

function isAppPopupFormPath(pathname: string) {
  return /\/(edit|new)(\/|$)/.test(pathname);
}

const matchesPathSegment = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export function koreaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;

  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function isAppPopupSuppressed(
  hiddenDate: string | null,
  sessionClosed: boolean,
  now = new Date(),
) {
  return hiddenDate === koreaDateKey(now) || sessionClosed;
}

export function popupSlideIndex(
  scrollLeft: number,
  slideWidth: number,
  slideCount: number,
) {
  if (slideCount <= 0 || slideWidth <= 0) return 0;
  return Math.min(
    Math.max(Math.round(scrollLeft / slideWidth), 0),
    slideCount - 1,
  );
}

export function popupActiveSlideIndex(activeSlide: number, slideCount: number) {
  return Math.min(Math.max(activeSlide, 0), Math.max(slideCount - 1, 0));
}

export function isActivePopupImageReady(
  readyIds: ReadonlySet<string>,
  popups: readonly { id: string }[],
  activeSlide: number,
) {
  const popup = popups[popupActiveSlideIndex(activeSlide, popups.length)];
  return popup ? readyIds.has(popup.id) : false;
}
