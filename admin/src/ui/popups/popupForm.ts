import {
  APP_POPUP_PLACEMENTS,
  type AdminAppPopupInput,
} from "@blending/admin-contracts";

const kstDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function fromKstDateTimeLocal(value: string) {
  return new Date(`${value}:00+09:00`).toISOString();
}

export function toKstDateTimeLocal(iso: string) {
  const parts = Object.fromEntries(
    kstDateTimeFormatter
      .formatToParts(new Date(iso))
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export const formatKstDateTime = (iso: string) =>
  toKstDateTimeLocal(iso).replace("T", " ");

export function parsePopupForm(values: Record<string, FormDataEntryValue>) {
  const selected = APP_POPUP_PLACEMENTS.filter(
    (placement) => values[`placement:${placement}`] === "on",
  );
  return {
    adminTitle: String(values.adminTitle ?? "").trim(),
    imageUrl: String(values.imageUrl ?? "").trim(),
    imageAlt: String(values.imageAlt ?? "").trim(),
    href: String(values.href ?? "").trim() || null,
    placements:
      values.allPlacements === "on" ? [...APP_POPUP_PLACEMENTS] : selected,
    priority: Number(values.priority),
    startsAt: fromKstDateTimeLocal(String(values.startsAt)),
    endsAt: fromKstDateTimeLocal(String(values.endsAt)),
    enabled: values.enabled === "on",
  } satisfies AdminAppPopupInput;
}
