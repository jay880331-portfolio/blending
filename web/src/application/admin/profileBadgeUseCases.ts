import {
  isProfileBadgeIcon,
  type AdminProfileBadgeDto,
  type AdminProfileBadgeInput,
  type AdminUserBadgeDto,
  type OfficialProfileBadge,
  type ProfileBadgeIcon,
} from "@blending/admin-contracts";
import type { ClientSession } from "mongodb";

export class ProfileBadgeInputError extends Error {}
export class ProfileBadgeConflictError extends Error {}

export const PROFILE_BADGE_NAME_MAX_LENGTH = 12;

export interface AdminProfileBadgeRepository {
  list(): Promise<AdminProfileBadgeDto[]>;
  findById(id: string): Promise<AdminProfileBadgeDto | null>;
  create(
    input: AdminProfileBadgeInput,
    session: ClientSession,
  ): Promise<AdminProfileBadgeDto>;
  update(
    id: string,
    input: AdminProfileBadgeInput,
    session: ClientSession,
  ): Promise<AdminProfileBadgeDto | null>;
  delete(
    id: string,
    session: ClientSession,
  ): Promise<AdminProfileBadgeDto | null>;
  listForOwner(ownerId: string): Promise<OfficialProfileBadge[]>;
  listPrimaryForOwners(
    ownerIds: string[],
  ): Promise<Map<string, OfficialProfileBadge>>;
  listAssignments(ownerId: string): Promise<AdminUserBadgeDto[]>;
  assign(
    ownerId: string,
    badgeId: string,
    assignedBy: string,
    session: ClientSession,
  ): Promise<AdminUserBadgeDto>;
  unassign(
    ownerId: string,
    badgeId: string,
    session: ClientSession,
  ): Promise<AdminUserBadgeDto | null>;
}

export function parseAdminProfileBadgeInput(
  value: unknown,
): AdminProfileBadgeInput {
  const input = record(value);
  return {
    name: badgeName(input.name),
    icon: badgeIcon(input.icon),
    imageUrl: badgeImageUrl(input.imageUrl),
    sortOrder: sortOrder(input.sortOrder),
  };
}

export function parseAssignAdminUserBadgeInput(value: unknown): {
  badgeId: string;
  reason: string;
} {
  const input = record(value);
  return {
    badgeId: text(input.badgeId, "뱃지"),
    reason: text(input.reason, "사유"),
  };
}

export function parseUnassignAdminUserBadgeInput(value: unknown): {
  reason: string;
} {
  return { reason: text(record(value).reason, "사유") };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ProfileBadgeInputError("뱃지 정보를 확인해주세요.");
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim())
    throw new ProfileBadgeInputError(`${label}를 확인해주세요.`);
  return value.trim();
}

function badgeName(value: unknown) {
  const name = text(value, "뱃지 이름");
  if (name.length > PROFILE_BADGE_NAME_MAX_LENGTH)
    throw new ProfileBadgeInputError(
      `뱃지 이름은 ${PROFILE_BADGE_NAME_MAX_LENGTH}자 이하여야 합니다.`,
    );
  return name;
}

function badgeIcon(value: unknown): ProfileBadgeIcon {
  if (typeof value !== "string" || !isProfileBadgeIcon(value))
    throw new ProfileBadgeInputError("뱃지 아이콘을 확인해주세요.");
  return value;
}

function badgeImageUrl(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string")
    throw new ProfileBadgeInputError("뱃지 이미지를 확인해주세요.");
  const url = value.trim();
  if (!url) return null;
  if (url.startsWith("/") && url[1] !== "/" && url[1] !== "\\") return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:")
      throw new ProfileBadgeInputError("뱃지 이미지를 확인해주세요.");
    return parsed.toString();
  } catch (error) {
    if (error instanceof ProfileBadgeInputError) throw error;
    throw new ProfileBadgeInputError("뱃지 이미지를 확인해주세요.");
  }
}

function sortOrder(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 0)
    throw new ProfileBadgeInputError("정렬 순서를 확인해주세요.");
  return parsed;
}
