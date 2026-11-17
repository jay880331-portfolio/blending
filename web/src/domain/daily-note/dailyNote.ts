import { isAllowedDailyNoteImageUrl } from "./dailyNoteImageUrl";

export const DAILY_NOTE_TECHNICAL_KEYS = [
  "machine",
  "beanName",
  "extractionTimeSec",
  "waterTemperatureC",
  "brixPercent",
  "grinder",
] as const;

export type DailyNoteTechnicalKey = (typeof DAILY_NOTE_TECHNICAL_KEYS)[number];

export type DailyNoteTechnicals = Partial<{
  beanName: string;
  extractionTimeSec: number;
  waterTemperatureC: number;
  brixPercent: number;
  machine: string;
  grinder: string;
}>;

export type DailyNoteComment = {
  id: string;
  authorId?: string;
  authorName: string;
  authorAvatarUrl?: string;
  createdAgo: string;
  createdAt?: string;
  body: string;
  likes: number;
  liked?: boolean;
  isOwner?: boolean;
  canManage?: boolean;
};

export type DailyNote = {
  id: string;
  author: {
    id: string;
    nickname: string;
    avatarUrl?: string;
    affiliation?: string;
    isBarista: boolean;
  };
  imageUrls: string[];
  note?: string;
  location?: { name: string; address: string };
  technicals: DailyNoteTechnicals;
  featuredTechnicalKeys: DailyNoteTechnicalKey[];
  liked: boolean;
  likeCount: number;
  commentCount: number;
  comments?: DailyNoteComment[];
  createdAt: string;
  isOwner?: boolean;
  canManage?: boolean;
};

export type DailyNoteFeedItem = Pick<
  DailyNote,
  "id" | "imageUrls" | "technicals" | "featuredTechnicalKeys" | "createdAt"
>;

export type DailyNoteInput = {
  imageUrls?: unknown;
  note?: unknown;
  location?: unknown;
  technicals?: unknown;
  featuredTechnicalKeys?: unknown;
};

export const dailyNoteTechnicalLabels: Record<DailyNoteTechnicalKey, string> = {
  beanName: "원두명",
  extractionTimeSec: "추출 시간",
  waterTemperatureC: "물 온도",
  brixPercent: "추출 수율",
  machine: "머신",
  grinder: "그라인더",
};

export function dailyNoteTechnicalEntries(technicals: DailyNoteTechnicals) {
  return DAILY_NOTE_TECHNICAL_KEYS.flatMap((key) => {
    const value = technicals[key];
    return value === undefined || value === ""
      ? []
      : [
          {
            key,
            label: dailyNoteTechnicalLabels[key],
            value: formatDailyNoteTechnical(key, value),
          },
        ];
  });
}

export function isDailyNoteTechnicalKey(
  value: unknown,
): value is DailyNoteTechnicalKey {
  return (
    typeof value === "string" &&
    (DAILY_NOTE_TECHNICAL_KEYS as readonly string[]).includes(value)
  );
}

export function formatDailyNoteTechnical(
  key: DailyNoteTechnicalKey,
  value: string | number | undefined,
) {
  if (value === undefined || value === "") return "";
  if (key === "extractionTimeSec") return `${value} SEC`;
  if (key === "waterTemperatureC") return `${value}°C`;
  if (key === "brixPercent") return `${value}% BRIX`;
  return String(value);
}

export function selectFeaturedTechnicalKey(
  selected: DailyNoteTechnicalKey[],
  key: DailyNoteTechnicalKey,
) {
  if (selected.includes(key)) return selected.filter((item) => item !== key);
  return selected.length < 2 ? [...selected, key] : selected;
}

export function removeEmptyFeaturedTechnicalKeys(
  selected: DailyNoteTechnicalKey[],
  technicals: DailyNoteTechnicals,
) {
  return selected.filter((key) => hasTechnicalValue(technicals, key));
}

export function mergeDailyNoteFeed<T extends { id: string; createdAt: string }>(
  current: T[],
  incoming: T[],
) {
  const byId = new Map<string, T>();
  [...current, ...incoming].forEach((item) => byId.set(item.id, item));
  return [...byId.values()].sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) ||
      right.id.localeCompare(left.id),
  );
}

export async function runSingleFlight<T>(
  pending: Set<string>,
  key: string,
  request: () => Promise<T>,
) {
  if (pending.has(key)) return;
  pending.add(key);
  try {
    return await request();
  } finally {
    pending.delete(key);
  }
}

export type DailyNoteCursor = Pick<DailyNote, "createdAt" | "id">;

export function encodeDailyNoteCursor(cursor: DailyNoteCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeDailyNoteCursor(
  value: string | null,
): DailyNoteCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return isRecord(parsed) &&
      typeof parsed.id === "string" &&
      parsed.id.trim().length > 0 &&
      typeof parsed.createdAt === "string" &&
      !Number.isNaN(Date.parse(parsed.createdAt))
      ? { id: parsed.id, createdAt: parsed.createdAt }
      : null;
  } catch {
    return null;
  }
}

export function validateDailyNoteInput(
  input: DailyNoteInput,
  imageOwnerId?: string,
) {
  const imageUrls = stringArray(input.imageUrls);
  if (imageUrls.length < 1 || imageUrls.length > 10)
    return "사진은 1장 이상 10장 이하로 등록해주세요.";
  if (!imageUrls.every((url) => isAllowedDailyNoteImageUrl(url, imageOwnerId)))
    return "이미지 주소를 확인해주세요.";

  const note = optionalString(input.note);
  if (note === null || (note?.length ?? 0) > 2000)
    return "NOTE는 2,000자 이하로 입력해주세요.";

  const technicals = normalizeDailyNoteTechnicals(input.technicals);
  if (!technicals) return "기술값을 확인해주세요.";
  const featuredTechnicalKeys = normalizeFeaturedTechnicalKeys(
    input.featuredTechnicalKeys,
  );
  if (!featuredTechnicalKeys)
    return "대표 기술값은 최대 2개까지 선택할 수 있습니다.";
  if (!featuredTechnicalKeys.every((key) => hasTechnicalValue(technicals, key)))
    return "대표 기술값에 해당하는 값을 입력해주세요.";
  if (!isDailyNoteLocation(input.location)) return "장소 정보를 확인해주세요.";
  return null;
}

export function normalizeDailyNoteTechnicals(
  value: unknown,
): DailyNoteTechnicals | null {
  if (value === undefined) return {};
  if (!isRecord(value)) return null;
  const technicals: DailyNoteTechnicals = {};
  for (const key of DAILY_NOTE_TECHNICAL_KEYS) {
    const item = value[key];
    if (item === undefined || item === "") continue;
    if (key === "beanName" || key === "machine" || key === "grinder") {
      if (typeof item !== "string" || item.trim().length > 100) return null;
      technicals[key] = item.trim();
      continue;
    }
    if (typeof item !== "number" || !Number.isFinite(item)) return null;
    const maximum =
      key === "extractionTimeSec"
        ? 3600
        : key === "waterTemperatureC"
          ? 150
          : 100;
    if (item < 0 || item > maximum) return null;
    technicals[key] = item;
  }
  return technicals;
}

export function normalizeFeaturedTechnicalKeys(
  value: unknown,
): DailyNoteTechnicalKey[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 2) return null;
  const keys = value.filter(isDailyNoteTechnicalKey);
  return keys.length === value.length && new Set(keys).size === keys.length
    ? keys
    : null;
}

export function isDailyNoteLocation(value: unknown) {
  if (value === undefined) return true;
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    value.name.trim().length <= 100 &&
    typeof value.address === "string" &&
    value.address.trim().length > 0 &&
    value.address.trim().length <= 300
  );
}

function hasTechnicalValue(
  technicals: DailyNoteTechnicals,
  key: DailyNoteTechnicalKey,
) {
  const value = technicals[key];
  return value !== undefined && value !== "";
}

function optionalString(value: unknown) {
  if (value === undefined) return undefined;
  return typeof value === "string" ? value.trim() : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value.map((item) => item.trim()).filter(Boolean)
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
