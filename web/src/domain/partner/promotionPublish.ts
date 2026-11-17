import type {
  PartnerAttachment,
  PartnerPromotion,
} from "@/domain/partner/types";

export function isPdfAttachment(
  attachment: Pick<PartnerAttachment, "contentType" | "name">,
) {
  return (
    attachment.contentType === "application/pdf" ||
    attachment.name.toLowerCase().endsWith(".pdf")
  );
}

export function promotionImageUrls(
  promotion: PartnerPromotion,
  imageUrls: string[],
) {
  if (imageUrls.length > 0) return imageUrls;
  return [promotion.thumbnailUrl].filter(
    (url) => url && url !== "/favicon.ico",
  );
}

function calendarDaySpan(from: string, to: string) {
  const start = new Date(from);
  const end = new Date(to);
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / (24 * 60 * 60 * 1000));
}

export function promotionPublishState(
  promotion: Pick<
    PartnerPromotion,
    "createdAt" | "publishedFrom" | "publishedTo"
  >,
  now = Date.now(),
) {
  const from = promotion.publishedFrom ?? promotion.createdAt;
  if (!promotion.publishedFrom && !promotion.publishedTo) {
    return {
      from,
      to: from,
      remainingDays: null,
      active: true,
      statusLabel: "게시 중",
    };
  }
  const to =
    promotion.publishedTo ??
    new Date(Date.parse(from) + 30 * 24 * 60 * 60 * 1000).toISOString();
  const remainingMs = Date.parse(to) - now;
  const remainingDays = Math.max(
    0,
    Math.ceil(remainingMs / (24 * 60 * 60 * 1000)),
  );
  const active = now >= Date.parse(from) && now <= Date.parse(to);
  return {
    from,
    to,
    remainingDays,
    active,
    statusLabel: active ? "게시 중" : "종료",
  };
}

export function formatPublishDate(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

export function addDaysIso(startIso: string, days: number) {
  const date = new Date(startIso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function toDateInputValue(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function periodDaysFromRange(
  from: string,
  to: string,
): 7 | 14 | 30 | "custom" {
  const days = calendarDaySpan(from, to);
  if (days === 7 || days === 14 || days === 30) return days;
  return "custom";
}
