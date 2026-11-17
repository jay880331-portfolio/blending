export const PROHIBITED_PUBLIC_CONTENT = {
  code: "PROHIBITED_CONTENT",
  message: "게시할 수 없는 표현이 포함되어 있습니다.",
} as const;

const prohibitedTerms = [
  "killyourself",
  "iwillkillyou",
  "죽여버려",
  "죽인다",
  "죽여",
  "너를죽여",
  "살인청부",
  "테러모집",
  "nigger",
  "faggot",
  "chink",
  "짱깨",
  "쪽바리",
  "한남",
  "한녀",
  "김치녀",
  "된장녀",
  "성매매",
  "조건만남",
  "매춘",
  "sexsale",
  "sexforsale",
  "prostitution",
  "rapeme",
  "마약판매",
  "마약팝니다",
  "마약구매",
  "대마판매",
  "대마팝니다",
  "코카인판매",
  "cocainesale",
  "selldrugs",
] as const;

const solicitationTerms = [
  "조건만남",
  "성매매",
  "매춘",
  "sexsale",
  "sexforsale",
  "prostitution",
  "마약판매",
  "마약팝니다",
  "마약구매",
  "대마판매",
  "대마팝니다",
  "코카인판매",
  "cocainesale",
  "selldrugs",
] as const;

const solicitationSuffixes = [
  "구해",
  "판매",
  "팝니다",
  "구매",
  "사요",
  "팔아요",
  "here",
  "now",
  "dm",
] as const;

const prohibitedPatterns = prohibitedTerms.map((term) =>
  boundedTermPattern(term),
);
const solicitationPatterns = solicitationTerms.flatMap((term) =>
  solicitationSuffixes.map((suffix) => solicitationPattern(term, suffix)),
);

export function normalizePublicText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\s\p{P}\p{S}_]/gu, "");
}

export function prohibitedPublicContent(
  ...values: Array<string | null | undefined>
) {
  const source = values
    .filter(Boolean)
    .join(" ")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\s\p{P}\p{S}_]+/gu, " ")
    .trim();
  return prohibitedPatterns.some((pattern) => pattern.test(source)) ||
    solicitationPatterns.some((pattern) => pattern.test(source))
    ? PROHIBITED_PUBLIC_CONTENT
    : null;
}

function boundedTermPattern(term: string) {
  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${termPattern(term)}(?=$|[^\\p{L}\\p{N}])`,
    "u",
  );
}

function termPattern(term: string) {
  return [...term]
    .map((character) => character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(" ?");
}

function solicitationPattern(term: string, suffix: string) {
  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${termPattern(term)} ?${termPattern(suffix)}`,
    "u",
  );
}
