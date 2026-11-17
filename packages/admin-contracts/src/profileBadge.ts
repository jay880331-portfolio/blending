export const PROFILE_BADGE_ICONS = [
  "crown",
  "coffee",
  "award",
  "star",
  "shield",
  "briefcase",
  "sparkles",
  "badge-check",
] as const;

export type ProfileBadgeIcon = (typeof PROFILE_BADGE_ICONS)[number];

export function isProfileBadgeIcon(value: string): value is ProfileBadgeIcon {
  return (PROFILE_BADGE_ICONS as readonly string[]).includes(value);
}

export const PROFILE_BADGE_ICON_LABELS: Record<ProfileBadgeIcon, string> = {
  crown: "왕관",
  coffee: "커피잔",
  award: "어워드",
  star: "별",
  shield: "방패",
  briefcase: "직함",
  sparkles: "스파클",
  "badge-check": "인증",
};

export type OfficialProfileBadge = {
  id: string;
  name: string;
  icon: ProfileBadgeIcon;
  imageUrl: string | null;
};

export type AdminProfileBadgeInput = {
  name: string;
  icon: ProfileBadgeIcon;
  imageUrl: string | null;
  sortOrder: number;
};

export type AdminProfileBadgeDto = AdminProfileBadgeInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserBadgeDto = OfficialProfileBadge & {
  assignmentId: string;
  assignedAt: string;
};

export type AssignAdminUserBadgeInput = {
  badgeId: string;
  reason: string;
};

export type UnassignAdminUserBadgeInput = {
  reason: string;
};
