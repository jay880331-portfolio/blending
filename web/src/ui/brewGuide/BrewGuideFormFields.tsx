"use client";

import {
  BREW_GUIDE_GRIND_MAX_LENGTH,
  BREW_GUIDE_RANGES,
  type BrewGuideEspresso,
  type BrewGuideFilter,
} from "@/domain/brewGuide/brewGuide";

export type BrewGuideRecipeDraft = {
  useFilter: boolean;
  filter: {
    doseG: string;
    grind: string;
    waterTempC: string;
    yieldG: string;
    timeSec: string;
  };
  useEspresso: boolean;
  espresso: {
    doseG: string;
    basketG: string;
    waterTempC: string;
    yieldG: string;
    timeSec: string;
  };
};

export function createInitialBrewGuideDraft(initial?: {
  filter?: BrewGuideFilter;
  espresso?: BrewGuideEspresso;
  waterTemperatureC?: number;
  extractionTimeSec?: number;
}): BrewGuideRecipeDraft {
  const defaultTemp =
    initial?.waterTemperatureC !== undefined
      ? String(initial.waterTemperatureC)
      : "93";
  const defaultTime =
    initial?.extractionTimeSec !== undefined
      ? String(initial.extractionTimeSec)
      : "150";
  return {
    useFilter: initial ? Boolean(initial.filter) || !initial.espresso : true,
    filter: {
      doseG: initial?.filter ? String(initial.filter.doseG) : "18",
      grind: initial?.filter?.grind ?? "중간-가늘게",
      waterTempC: initial?.filter
        ? String(initial.filter.waterTempC)
        : defaultTemp,
      yieldG: initial?.filter ? String(initial.filter.yieldG) : "280",
      timeSec: initial?.filter ? String(initial.filter.timeSec) : defaultTime,
    },
    useEspresso: Boolean(initial?.espresso),
    espresso: {
      doseG: initial?.espresso ? String(initial.espresso.doseG) : "19",
      basketG: initial?.espresso ? String(initial.espresso.basketG) : "20",
      waterTempC: initial?.espresso
        ? String(initial.espresso.waterTempC)
        : defaultTemp,
      yieldG: initial?.espresso ? String(initial.espresso.yieldG) : "38",
      timeSec: initial?.espresso
        ? String(initial.espresso.timeSec)
        : initial?.extractionTimeSec !== undefined
          ? String(initial.extractionTimeSec)
          : "28",
    },
  };
}

export function buildBrewGuideRecipesFromDraft(draft: BrewGuideRecipeDraft): {
  filter?: BrewGuideFilter;
  espresso?: BrewGuideEspresso;
} {
  return {
    ...(draft.useFilter
      ? {
          filter: {
            doseG: Number(draft.filter.doseG),
            grind: draft.filter.grind,
            waterTempC: Number(draft.filter.waterTempC),
            yieldG: Number(draft.filter.yieldG),
            timeSec: Number(draft.filter.timeSec),
          },
        }
      : {}),
    ...(draft.useEspresso
      ? {
          espresso: {
            doseG: Number(draft.espresso.doseG),
            basketG: Number(draft.espresso.basketG),
            waterTempC: Number(draft.espresso.waterTempC),
            yieldG: Number(draft.espresso.yieldG),
            timeSec: Number(draft.espresso.timeSec),
          },
        }
      : {}),
  };
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  min: number;
  max: number;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-[var(--fg-muted)]">
        {label}
      </span>
      <input
        type="number"
        step="any"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--fg)] outline-none focus:border-[var(--accent)]"
      />
    </label>
  );
}

export function BrewGuideFormFields({
  draft,
  onChange,
}: {
  draft: BrewGuideRecipeDraft;
  onChange: (next: BrewGuideRecipeDraft) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-md)] border border-[var(--border-strong)] p-3">
        <label className="flex items-center gap-2 text-[14px] font-bold text-[var(--fg-strong)]">
          <input
            type="checkbox"
            checked={draft.useFilter}
            onChange={(e) =>
              onChange({ ...draft, useFilter: e.target.checked })
            }
          />
          필터 (FILTER)
        </label>
        {draft.useFilter ? (
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <NumberInput
              label="원두량 (g)"
              value={draft.filter.doseG}
              min={BREW_GUIDE_RANGES.doseG.min}
              max={BREW_GUIDE_RANGES.doseG.max}
              onChange={(doseG) =>
                onChange({ ...draft, filter: { ...draft.filter, doseG } })
              }
            />
            <label className="block">
              <span className="text-[12px] font-medium text-[var(--fg-muted)]">
                분쇄도
              </span>
              <input
                type="text"
                maxLength={BREW_GUIDE_GRIND_MAX_LENGTH}
                value={draft.filter.grind}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    filter: { ...draft.filter, grind: e.target.value },
                  })
                }
                placeholder="예: 중간-가늘게"
                className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--fg)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <NumberInput
              label="물 온도 (°C)"
              value={draft.filter.waterTempC}
              min={BREW_GUIDE_RANGES.waterTempC.min}
              max={BREW_GUIDE_RANGES.waterTempC.max}
              onChange={(waterTempC) =>
                onChange({ ...draft, filter: { ...draft.filter, waterTempC } })
              }
            />
            <NumberInput
              label="추출량 (g)"
              value={draft.filter.yieldG}
              min={BREW_GUIDE_RANGES.yieldG.min}
              max={BREW_GUIDE_RANGES.yieldG.max}
              onChange={(yieldG) =>
                onChange({ ...draft, filter: { ...draft.filter, yieldG } })
              }
            />
            <NumberInput
              label="추출 시간 (초)"
              value={draft.filter.timeSec}
              min={BREW_GUIDE_RANGES.timeSec.min}
              max={BREW_GUIDE_RANGES.timeSec.max}
              onChange={(timeSec) =>
                onChange({ ...draft, filter: { ...draft.filter, timeSec } })
              }
            />
          </div>
        ) : null}
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--border-strong)] p-3">
        <label className="flex items-center gap-2 text-[14px] font-bold text-[var(--fg-strong)]">
          <input
            type="checkbox"
            checked={draft.useEspresso}
            onChange={(e) =>
              onChange({ ...draft, useEspresso: e.target.checked })
            }
          />
          에스프레소 (ESPRESSO)
        </label>
        {draft.useEspresso ? (
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <NumberInput
              label="원두량 (g)"
              value={draft.espresso.doseG}
              min={BREW_GUIDE_RANGES.doseG.min}
              max={BREW_GUIDE_RANGES.doseG.max}
              onChange={(doseG) =>
                onChange({ ...draft, espresso: { ...draft.espresso, doseG } })
              }
            />
            <NumberInput
              label="바스켓 (g)"
              value={draft.espresso.basketG}
              min={BREW_GUIDE_RANGES.basketG.min}
              max={BREW_GUIDE_RANGES.basketG.max}
              onChange={(basketG) =>
                onChange({
                  ...draft,
                  espresso: { ...draft.espresso, basketG },
                })
              }
            />
            <NumberInput
              label="물 온도 (°C)"
              value={draft.espresso.waterTempC}
              min={BREW_GUIDE_RANGES.waterTempC.min}
              max={BREW_GUIDE_RANGES.waterTempC.max}
              onChange={(waterTempC) =>
                onChange({
                  ...draft,
                  espresso: { ...draft.espresso, waterTempC },
                })
              }
            />
            <NumberInput
              label="추출량 (g)"
              value={draft.espresso.yieldG}
              min={BREW_GUIDE_RANGES.yieldG.min}
              max={BREW_GUIDE_RANGES.yieldG.max}
              onChange={(yieldG) =>
                onChange({ ...draft, espresso: { ...draft.espresso, yieldG } })
              }
            />
            <NumberInput
              label="추출 시간 (초)"
              value={draft.espresso.timeSec}
              min={BREW_GUIDE_RANGES.timeSec.min}
              max={BREW_GUIDE_RANGES.timeSec.max}
              onChange={(timeSec) =>
                onChange({
                  ...draft,
                  espresso: { ...draft.espresso, timeSec },
                })
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
