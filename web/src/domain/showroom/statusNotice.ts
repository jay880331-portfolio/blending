export const STATUS_NOTICE_MAX_LENGTH = 40;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export type ShowroomNoticeExpiryOption = "3h" | "6h" | "today_end";

export type ShowroomStatusNotice = {
  text: string;
  createdAt: string;
  expiresAt: string;
};

export type StoredShowroomStatusNotice = ShowroomStatusNotice & {
  updatedBy: string;
};

export function validateStatusNoticeText(
  raw: string,
): { ok: true; text: string } | { ok: false; error: string } {
  const text = raw.trim();
  if (!text) {
    return { ok: false, error: "한줄공지 내용을 입력해주세요." };
  }
  if ([...text].length > STATUS_NOTICE_MAX_LENGTH) {
    return {
      ok: false,
      error: `한줄공지는 ${STATUS_NOTICE_MAX_LENGTH}자 이하로 입력해주세요.`,
    };
  }
  return { ok: true, text };
}

export function isValidNoticeExpiryOption(
  value: unknown,
): value is ShowroomNoticeExpiryOption {
  return value === "3h" || value === "6h" || value === "today_end";
}

export function computeStatusNoticeExpiresAt(
  option: ShowroomNoticeExpiryOption,
  now = new Date(),
): Date {
  if (option === "3h") {
    return new Date(now.getTime() + 3 * 60 * 60 * 1000);
  }
  if (option === "6h") {
    return new Date(now.getTime() + 6 * 60 * 60 * 1000);
  }
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const endOfKstDayUtcMs =
    Date.UTC(
      kst.getUTCFullYear(),
      kst.getUTCMonth(),
      kst.getUTCDate(),
      23,
      59,
      59,
      999,
    ) - KST_OFFSET_MS;
  return new Date(endOfKstDayUtcMs);
}

export function getActiveStatusNotice(
  notice: (ShowroomStatusNotice & { updatedBy?: string }) | null | undefined,
  now = new Date(),
): ShowroomStatusNotice | null {
  if (!notice || !notice.text?.trim() || !notice.expiresAt) {
    return null;
  }
  const expiresAtMs = Date.parse(notice.expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now.getTime()) {
    return null;
  }
  return {
    text: notice.text,
    createdAt: notice.createdAt,
    expiresAt: notice.expiresAt,
  };
}

export function hasActiveStatusNotice(
  notice: ShowroomStatusNotice | null | undefined,
  now = new Date(),
): boolean {
  return getActiveStatusNotice(notice, now) !== null;
}
