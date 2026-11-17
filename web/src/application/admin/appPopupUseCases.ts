import type {
  AdminAppPopupDto,
  AdminAppPopupInput,
  AppPopupDto,
  AppPopupPlacement,
} from "@blending/admin-contracts";
import { APP_POPUP_PLACEMENTS } from "@blending/admin-contracts";
import type { ClientSession } from "mongodb";

export class AppPopupInputError extends Error {}

export interface AdminAppPopupRepository {
  list(): Promise<AdminAppPopupDto[]>;
  findById(id: string): Promise<AdminAppPopupDto | null>;
  create(
    input: AdminAppPopupInput,
    session: ClientSession,
  ): Promise<AdminAppPopupDto>;
  update(
    id: string,
    input: AdminAppPopupInput,
    session: ClientSession,
  ): Promise<AdminAppPopupDto | null>;
  delete(id: string, session: ClientSession): Promise<AdminAppPopupDto | null>;
  setEnabled(
    id: string,
    enabled: boolean,
    session: ClientSession,
  ): Promise<AdminAppPopupDto | null>;
}

export interface AppPopupQueryRepository {
  listActive(placement: AppPopupPlacement, now: string): Promise<AppPopupDto[]>;
}

export function parseAdminAppPopupInput(value: unknown): AdminAppPopupInput {
  const input = record(value);
  const startsAt = dateTime(input.startsAt, "노출 시작 시각");
  const endsAt = dateTime(input.endsAt, "노출 종료 시각");
  if (Date.parse(startsAt) >= Date.parse(endsAt))
    throw new AppPopupInputError("노출 기간을 확인해주세요.");
  if (
    typeof input.priority !== "number" ||
    !Number.isInteger(input.priority) ||
    input.priority < 0
  )
    throw new AppPopupInputError("우선순위를 확인해주세요.");
  if (typeof input.enabled !== "boolean")
    throw new AppPopupInputError("노출 상태를 확인해주세요.");

  const placements = input.placements;
  if (!Array.isArray(placements) || !placements.length)
    throw new AppPopupInputError("노출 위치를 확인해주세요.");
  if (
    !placements.every(
      (placement): placement is AppPopupPlacement =>
        typeof placement === "string" &&
        APP_POPUP_PLACEMENTS.includes(placement as AppPopupPlacement),
    )
  )
    throw new AppPopupInputError("노출 위치를 확인해주세요.");

  return {
    adminTitle: text(input.adminTitle, "관리자 제목"),
    imageUrl: text(input.imageUrl, "이미지 URL"),
    imageAlt: text(input.imageAlt, "이미지 대체 텍스트"),
    href: safeHref(input.href),
    placements: [...new Set(placements)],
    priority: input.priority,
    startsAt,
    endsAt,
    enabled: input.enabled,
  };
}

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AppPopupInputError("팝업 정보를 확인해주세요.");
  return value as Record<string, unknown>;
};

const text = (value: unknown, label: string) => {
  if (typeof value !== "string" || !value.trim())
    throw new AppPopupInputError(`${label}을 확인해주세요.`);
  return value.trim();
};

const dateTime = (value: unknown, label: string) => {
  const valueText = text(value, label);
  if (Number.isNaN(Date.parse(valueText)))
    throw new AppPopupInputError(`${label}을 확인해주세요.`);
  return new Date(valueText).toISOString();
};

const safeHref = (value: unknown) => {
  if (value == null || value === "") return null;
  if (typeof value !== "string")
    throw new AppPopupInputError("이동 URL을 확인해주세요.");
  if (value.startsWith("/") && value[1] !== "/" && value[1] !== "\\")
    return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:")
      throw new AppPopupInputError("이동 URL을 확인해주세요.");
    return url.toString();
  } catch (error) {
    if (error instanceof AppPopupInputError) throw error;
    throw new AppPopupInputError("이동 URL을 확인해주세요.");
  }
};
