export const BREW_GUIDE_TITLE_MAX_LENGTH = 40;
export const BREW_GUIDE_GRIND_MAX_LENGTH = 20;

export const BREW_GUIDE_RANGES = {
  doseG: { min: 5, max: 40 },
  basketG: { min: 7, max: 30 },
  waterTempC: { min: 70, max: 100 },
  yieldG: { min: 10, max: 600 },
  timeSec: { min: 10, max: 600 },
} as const;

export type BrewGuideFilter = {
  doseG: number;
  grind: string;
  waterTempC: number;
  yieldG: number;
  timeSec: number;
};

export type BrewGuideEspresso = {
  doseG: number;
  basketG: number;
  waterTempC: number;
  yieldG: number;
  timeSec: number;
};

export type BrewGuide = {
  id: string;
  storeId: string;
  beanId: string | null;
  title: string;
  filter?: BrewGuideFilter;
  espresso?: BrewGuideEspresso;
  createdAt: string;
  updatedAt: string;
  storeName?: string;
  authorName?: string;
  authorHandle?: string;
  beanActive?: boolean;
};

export type ParsedBrewGuideInput = {
  title: string;
  beanId: string | null;
  filter?: BrewGuideFilter;
  espresso?: BrewGuideEspresso;
};

function parseNumberInRange(
  value: unknown,
  label: string,
  range: { min: number; max: number },
): { ok: true; value: number } | { ok: false; error: string } {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, error: `${label} 값을 숫자로 입력해주세요.` };
  }
  if (value < range.min || value > range.max) {
    return {
      ok: false,
      error: `${label} 값은 ${range.min}~${range.max} 범위로 입력해주세요.`,
    };
  }
  return { ok: true, value };
}

function parseFilterRecipe(
  raw: unknown,
): { ok: true; value: BrewGuideFilter } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "필터 레시피 형식이 올바르지 않습니다." };
  }
  const input = raw as Record<string, unknown>;
  const doseG = parseNumberInRange(
    input.doseG,
    "필터 원두량(g)",
    BREW_GUIDE_RANGES.doseG,
  );
  if (!doseG.ok) return doseG;

  const grind = typeof input.grind === "string" ? input.grind.trim() : "";
  if (!grind || [...grind].length > BREW_GUIDE_GRIND_MAX_LENGTH) {
    return {
      ok: false,
      error: `필터 분쇄도는 1~${BREW_GUIDE_GRIND_MAX_LENGTH}자로 입력해주세요.`,
    };
  }

  const waterTempC = parseNumberInRange(
    input.waterTempC,
    "필터 물 온도(°C)",
    BREW_GUIDE_RANGES.waterTempC,
  );
  if (!waterTempC.ok) return waterTempC;

  const yieldG = parseNumberInRange(
    input.yieldG,
    "필터 추출량(g)",
    BREW_GUIDE_RANGES.yieldG,
  );
  if (!yieldG.ok) return yieldG;

  const timeSec = parseNumberInRange(
    input.timeSec,
    "필터 추출 시간(초)",
    BREW_GUIDE_RANGES.timeSec,
  );
  if (!timeSec.ok) return timeSec;

  return {
    ok: true,
    value: {
      doseG: doseG.value,
      grind,
      waterTempC: waterTempC.value,
      yieldG: yieldG.value,
      timeSec: timeSec.value,
    },
  };
}

function parseEspressoRecipe(
  raw: unknown,
): { ok: true; value: BrewGuideEspresso } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "에스프레소 레시피 형식이 올바르지 않습니다." };
  }
  const input = raw as Record<string, unknown>;
  const doseG = parseNumberInRange(
    input.doseG,
    "에스프레소 원두량(g)",
    BREW_GUIDE_RANGES.doseG,
  );
  if (!doseG.ok) return doseG;

  const basketG = parseNumberInRange(
    input.basketG,
    "바스켓 용량(g)",
    BREW_GUIDE_RANGES.basketG,
  );
  if (!basketG.ok) return basketG;

  const waterTempC = parseNumberInRange(
    input.waterTempC,
    "에스프레소 물 온도(°C)",
    BREW_GUIDE_RANGES.waterTempC,
  );
  if (!waterTempC.ok) return waterTempC;

  const yieldG = parseNumberInRange(
    input.yieldG,
    "에스프레소 추출량(g)",
    BREW_GUIDE_RANGES.yieldG,
  );
  if (!yieldG.ok) return yieldG;

  const timeSec = parseNumberInRange(
    input.timeSec,
    "에스프레소 추출 시간(초)",
    BREW_GUIDE_RANGES.timeSec,
  );
  if (!timeSec.ok) return timeSec;

  return {
    ok: true,
    value: {
      doseG: doseG.value,
      basketG: basketG.value,
      waterTempC: waterTempC.value,
      yieldG: yieldG.value,
      timeSec: timeSec.value,
    },
  };
}

export function parseBrewGuideInput(
  raw: unknown,
): { ok: true; value: ParsedBrewGuideInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "브루 가이드 입력값이 올바르지 않습니다." };
  }
  const input = raw as Record<string, unknown>;

  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title || [...title].length > BREW_GUIDE_TITLE_MAX_LENGTH) {
    return {
      ok: false,
      error: `원두명(제목)은 1~${BREW_GUIDE_TITLE_MAX_LENGTH}자로 입력해주세요.`,
    };
  }

  let beanId: string | null = null;
  if (typeof input.beanId === "string" && input.beanId.trim()) {
    beanId = input.beanId.trim();
  }

  const hasFilter = input.filter !== undefined && input.filter !== null;
  const hasEspresso = input.espresso !== undefined && input.espresso !== null;
  if (!hasFilter && !hasEspresso) {
    return {
      ok: false,
      error: "필터 또는 에스프레소 레시피 중 하나 이상을 입력해주세요.",
    };
  }

  let filter: BrewGuideFilter | undefined;
  if (hasFilter) {
    const parsedFilter = parseFilterRecipe(input.filter);
    if (!parsedFilter.ok) return parsedFilter;
    filter = parsedFilter.value;
  }

  let espresso: BrewGuideEspresso | undefined;
  if (hasEspresso) {
    const parsedEspresso = parseEspressoRecipe(input.espresso);
    if (!parsedEspresso.ok) return parsedEspresso;
    espresso = parsedEspresso.value;
  }

  return {
    ok: true,
    value: {
      title,
      beanId,
      ...(filter ? { filter } : {}),
      ...(espresso ? { espresso } : {}),
    },
  };
}
