import {
  PASSPORT_DECAF_LABEL,
  PASSPORT_FLAVOR_LABELS,
  PASSPORT_MENU_LABELS,
  type CoffeePassport,
  type StoreTasteProfile,
} from "./passport";

export const PASSPORT_MAP_TAGS = [
  { value: "acidity", label: "#산미맛집" },
  { value: "nutty", label: "#고소다크" },
  { value: "decaf", label: "#디카페인" },
  { value: "handdrip", label: "#핸드드립" },
  { value: "beans", label: "#원두예약가능" },
] as const;

export type PassportMapTag = (typeof PASSPORT_MAP_TAGS)[number]["value"];

export type StoreMatchResult = {
  matched: boolean;
  tags: string[];
  reasons: string[];
};

export function extractStoreTasteTags(
  tasteProfile: StoreTasteProfile | undefined,
): string[] {
  if (!tasteProfile) return [];
  const tags: string[] = [];
  if (tasteProfile.flavors.includes("acidity")) tags.push("#산미맛집");
  if (tasteProfile.flavors.includes("nutty")) tags.push("#고소다크");
  if (tasteProfile.flavors.includes("sweet")) tags.push("#단맛밸런스");
  if (tasteProfile.hasDecaf) tags.push("#디카페인");
  if (tasteProfile.signatureMenus.includes("handdrip")) tags.push("#핸드드립");
  return tags;
}

export function matchStoreTags(
  passport: CoffeePassport | null | undefined,
  tasteProfile: StoreTasteProfile | undefined,
): StoreMatchResult {
  const tags = extractStoreTasteTags(tasteProfile);
  if (!passport || !tasteProfile) {
    return { matched: false, tags, reasons: [] };
  }

  const reasons: string[] = [];
  if (tasteProfile.flavors.includes(passport.flavor)) {
    reasons.push(PASSPORT_FLAVOR_LABELS[passport.flavor]);
  }
  for (const menu of passport.menus) {
    if (tasteProfile.signatureMenus.includes(menu)) {
      reasons.push(PASSPORT_MENU_LABELS[menu]);
    }
  }
  if (passport.decaf && tasteProfile.hasDecaf) {
    reasons.push(PASSPORT_DECAF_LABEL);
  }

  return {
    matched: reasons.length > 0,
    tags,
    reasons,
  };
}

export function storeMatchesTagFilters(
  tasteProfile: StoreTasteProfile | undefined,
  selectedTags: PassportMapTag[],
  hasActiveBeans = false,
): boolean {
  if (selectedTags.length === 0) return true;

  return selectedTags.every((tag) => {
    if (tag === "beans") return hasActiveBeans;
    if (!tasteProfile) return false;
    if (tag === "acidity") return tasteProfile.flavors.includes("acidity");
    if (tag === "nutty") return tasteProfile.flavors.includes("nutty");
    if (tag === "decaf") return tasteProfile.hasDecaf;
    if (tag === "handdrip") {
      return tasteProfile.signatureMenus.includes("handdrip");
    }
    return false;
  });
}
