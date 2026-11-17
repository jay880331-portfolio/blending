import type { CareerItem } from "./types";

const YEAR_PATTERN = /^\d{4}$/;
const CAREER_PERIOD_PATTERN = /^(\d{4})\s~\s(\d{4}|현재)$/;
const LETTER_PATTERN = /[A-Za-z가-힣]/;

export type CareerDraft = Pick<
  CareerItem,
  "id" | "type" | "year" | "title" | "organization" | "detail"
>;

function yearMatches(value: string) {
  const years = value.match(/\d{4}/g);
  if (years) return years;

  return value.replace(/\D/g, "").match(/\d{4}/g) ?? [];
}

export function normalizeCareerYear(value: string) {
  const years = yearMatches(value);
  if (years.length >= 2) return `${years[0]} ~ ${years[1]}`;
  return years[0]
    ? `${years[0]} ~ ${value.includes("현재") ? "현재" : years[0]}`
    : "";
}

export function normalizeAwardYear(value: string) {
  return yearMatches(value)[0] ?? "";
}

export function hasMeaningfulCareerText(value: string) {
  const text = value.trim();
  if (!text) return false;
  if (!LETTER_PATTERN.test(text)) return false;

  const compact = text.replace(/\s/g, "");
  if (compact.length >= 3 && new Set([...compact]).size === 1) return false;

  return true;
}

export function hasCompleteCareerRequiredFields(items: CareerDraft[]) {
  return items.every(
    (item) =>
      Boolean(item.title.trim()) &&
      Boolean(item.organization?.trim()) &&
      (item.type === "award"
        ? YEAR_PATTERN.test(item.year.trim())
        : CAREER_PERIOD_PATTERN.test(item.year.trim())),
  );
}

export function validateCareerDraft(item: CareerDraft) {
  if (item.type === "award") {
    if (!YEAR_PATTERN.test(item.year.trim())) {
      return "수상 연도는 YYYY 형식으로 선택해주세요.";
    }
  } else {
    const periodMatch = item.year.trim().match(CAREER_PERIOD_PATTERN);
    if (!periodMatch) {
      return "연도는 YYYY ~ YYYY 형식의 기간으로 선택해주세요.";
    }

    const [, startYear, endYear] = periodMatch;
    const end = endYear === "현재" ? new Date().getFullYear() : Number(endYear);
    if (
      !YEAR_PATTERN.test(startYear) ||
      (endYear !== "현재" && !YEAR_PATTERN.test(endYear)) ||
      Number(startYear) > end
    ) {
      return "시작 연도는 종료 연도보다 늦을 수 없습니다.";
    }
  }

  if (
    !hasMeaningfulCareerText(item.title) ||
    !hasMeaningfulCareerText(item.organization ?? "")
  ) {
    return "수상명과 수상 기관은 의미 있는 내용으로 입력해주세요.";
  }

  if (item.detail?.trim() && !hasMeaningfulCareerText(item.detail)) {
    return "상세 성과는 의미 있는 내용으로 입력해주세요.";
  }

  return null;
}

function careerPeriodRange(item: CareerDraft) {
  if (item.type !== "career") return null;

  const periodMatch = item.year.trim().match(CAREER_PERIOD_PATTERN);
  if (!periodMatch) return null;

  return {
    id: item.id,
    start: Number(periodMatch[1]),
    end:
      periodMatch[2] === "현재"
        ? new Date().getFullYear()
        : Number(periodMatch[2]),
  };
}

function validateCareerPeriodOverlaps(items: CareerDraft[]) {
  const careerRanges = items
    .map(careerPeriodRange)
    .filter((range): range is NonNullable<typeof range> => range !== null)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  for (let index = 1; index < careerRanges.length; index += 1) {
    const previous = careerRanges[index - 1];
    const current = careerRanges[index];
    if (current.start <= previous.end) {
      return "경력 기간이 겹칩니다. 기간이 겹치지 않도록 수정해주세요.";
    }
  }

  return null;
}

export function validateCareerDrafts(items: CareerDraft[]) {
  if (items.length === 0) return null;

  for (const item of items) {
    const message = validateCareerDraft(item);
    if (message) return message;
  }

  return validateCareerPeriodOverlaps(items);
}
