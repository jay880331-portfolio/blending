export const PASSPORT_FLAVORS = [
  { value: "acidity", label: "산미" },
  { value: "nutty", label: "고소·묵직" },
  { value: "sweet", label: "단맛·밸런스" },
] as const;

export const PASSPORT_MENUS = [
  { value: "americano", label: "아메리카노" },
  { value: "latte", label: "카페라떼" },
  { value: "handdrip", label: "핸드드립" },
  { value: "espresso", label: "에스프레소" },
] as const;

export const PASSPORT_DECAF_LABEL = "디카페인 선호";

export type PassportFlavor = (typeof PASSPORT_FLAVORS)[number]["value"];
export type PassportMenu = (typeof PASSPORT_MENUS)[number]["value"];

export type CoffeePassport = {
  flavor: PassportFlavor;
  menus: PassportMenu[];
  decaf: boolean;
  issuedAt: string;
};

export type StoreTasteProfile = {
  flavors: PassportFlavor[];
  signatureMenus: PassportMenu[];
  hasDecaf: boolean;
};

const FLAVOR_SET = new Set<string>(PASSPORT_FLAVORS.map((f) => f.value));
const MENU_SET = new Set<string>(PASSPORT_MENUS.map((m) => m.value));

export const PASSPORT_FLAVOR_LABELS: Record<PassportFlavor, string> = {
  acidity: "산미",
  nutty: "고소·묵직",
  sweet: "단맛·밸런스",
};

export const PASSPORT_MENU_LABELS: Record<PassportMenu, string> = {
  americano: "아메리카노",
  latte: "카페라떼",
  handdrip: "핸드드립",
  espresso: "에스프레소",
};

export function isPassportFlavor(value: unknown): value is PassportFlavor {
  return typeof value === "string" && FLAVOR_SET.has(value);
}

export function isPassportMenu(value: unknown): value is PassportMenu {
  return typeof value === "string" && MENU_SET.has(value);
}

export function parsePassportInput(
  raw: unknown,
):
  | { ok: true; value: Omit<CoffeePassport, "issuedAt"> }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "여권 입력값이 올바르지 않습니다." };
  }
  const input = raw as Record<string, unknown>;

  if (!isPassportFlavor(input.flavor)) {
    return { ok: false, error: "선호 풍미를 선택해주세요." };
  }

  if (!Array.isArray(input.menus)) {
    return { ok: false, error: "선호 메뉴를 1개 이상 선택해주세요." };
  }

  const menus: PassportMenu[] = [];
  for (const item of input.menus) {
    if (!isPassportMenu(item)) {
      return { ok: false, error: "선택한 메뉴 값이 올바르지 않습니다." };
    }
    if (!menus.includes(item)) menus.push(item);
  }
  if (menus.length === 0) {
    return { ok: false, error: "선호 메뉴를 1개 이상 선택해주세요." };
  }

  if (typeof input.decaf !== "boolean") {
    return { ok: false, error: "디카페인 선호 여부를 선택해주세요." };
  }

  return {
    ok: true,
    value: {
      flavor: input.flavor,
      menus,
      decaf: input.decaf,
    },
  };
}

export function parseStoreTasteProfile(
  raw: unknown,
): { ok: true; value: StoreTasteProfile } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "매장 취향 정보가 올바르지 않습니다." };
  }
  const input = raw as Record<string, unknown>;

  if (!Array.isArray(input.flavors) || !Array.isArray(input.signatureMenus)) {
    return { ok: false, error: "매장 취향 정보가 올바르지 않습니다." };
  }

  const flavors: PassportFlavor[] = [];
  for (const item of input.flavors) {
    if (!isPassportFlavor(item)) {
      return { ok: false, error: "매장 풍미 값이 올바르지 않습니다." };
    }
    if (!flavors.includes(item)) flavors.push(item);
  }

  const signatureMenus: PassportMenu[] = [];
  for (const item of input.signatureMenus) {
    if (!isPassportMenu(item)) {
      return { ok: false, error: "매장 시그니처 메뉴 값이 올바르지 않습니다." };
    }
    if (!signatureMenus.includes(item)) signatureMenus.push(item);
  }

  if (typeof input.hasDecaf !== "boolean") {
    return { ok: false, error: "디카페인 제공 여부가 올바르지 않습니다." };
  }

  return {
    ok: true,
    value: {
      flavors,
      signatureMenus,
      hasDecaf: input.hasDecaf,
    },
  };
}

export function formatPassportSummary(passport: CoffeePassport): string {
  const parts = [
    PASSPORT_FLAVOR_LABELS[passport.flavor],
    passport.menus.map((m) => PASSPORT_MENU_LABELS[m]).join(", "),
  ];
  if (passport.decaf) {
    parts.push(PASSPORT_DECAF_LABEL);
  }
  return parts.join(" · ");
}
