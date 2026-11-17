import type { AdminListQuery, AdminPage } from "./common";

export const ADMIN_USER_STATUSES = ["active", "suspended", "deleted"] as const;
export type AdminUserStatus = (typeof ADMIN_USER_STATUSES)[number];
export const ADMIN_USER_ROLES = [
  "barista",
  "enthusiast",
  "partner",
  "admin",
] as const;
export type AdminUserRole = (typeof ADMIN_USER_ROLES)[number];
export const ADMIN_LOGIN_METHODS = [
  "phone",
  "kakao",
  "naver",
  "apple",
] as const;
export type AdminLoginMethod = (typeof ADMIN_LOGIN_METHODS)[number];
export const ADMIN_USER_SORTS = ["createdAt", "lastLoginAt", "name"] as const;

export type AdminUserListQuery = AdminListQuery & {
  role?: AdminUserRole;
  loginMethod?: AdminLoginMethod;
  sort?: (typeof ADMIN_USER_SORTS)[number];
};
export type CreateAdminManagedUserInput = {
  phone: string;
  email?: string;
  password: string;
  name: string;
  handle: string;
  role: AdminUserRole;
};
export type UpdateAdminManagedUserInput = {
  name?: string;
  handle?: string;
  phone?: string;
  email?: string;
  reason: string;
};
export type ChangeAdminUserStatusInput = {
  status: AdminUserStatus;
  reason: string;
};
export type ChangeAdminUserRoleInput = {
  role: AdminUserRole;
  reason: string;
};
export type AdminUserDto = {
  id: string;
  name: string;
  handle?: string;
  phone?: string;
  email?: string;
  role: AdminUserRole;
  accountStatus: AdminUserStatus;
  lastLoginMethod?: AdminLoginMethod;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
};
export type AdminUserPage = AdminPage<AdminUserDto>;
export type AdminUserDetailDto = AdminUserDto & {
  isLastActiveAdmin: boolean;
};

export const ADMIN_USER_RELATED_KINDS = [
  "activity",
  "favorites",
  "recipes",
  "notifications",
  "messages",
  "settings",
  "auth",
] as const;
export type AdminUserRelatedKind = (typeof ADMIN_USER_RELATED_KINDS)[number];
export type AdminUserRelatedQuery = AdminListQuery & {
  kind: AdminUserRelatedKind;
};
export type AdminRelatedItemAction =
  | { action: "soft-delete"; reason: string }
  | { action: "restore"; reason: string }
  | { action: "revoke"; reason: string };
export type AdminUserRelatedItemDto = {
  id: string;
  itemType?: "message" | "chat-room" | "login" | "push-token";
  manageable?: boolean;
  type?: string;
  title?: string;
  createdAt?: string;
  targetId?: string;
  profileId?: string;
  name?: string;
  category?: string;
  deletedAt?: string;
  kind?: string;
  read?: boolean;
  sender?: string;
  recipient?: string;
  timestamp?: string;
  status?: string;
  key?: string;
  enabled?: boolean;
  method?: string;
  platform?: string;
  lastLoginAt?: string;
  updatedAt?: string;
  body?: string;
  counterpartId?: string;
  blocked?: boolean;
  muted?: boolean;
  leftAt?: string;
};
export type AdminUserRelatedPage = AdminPage<AdminUserRelatedItemDto> & {
  auditId?: string;
};

export type AdminUserProfileDto = {
  id: string;
  name: string;
  handle: string;
  workplace: string;
  bio: string;
  status: "guest" | "job-seeking" | "focused";
  isPortfolioPublic: boolean;
};
export type UpdateAdminUserProfileInput = Partial<
  Omit<AdminUserProfileDto, "id">
> & { reason: string };
export type AdminUserCareerDto = {
  id: string;
  type: "career" | "award";
  year: string;
  period: string;
  title: string;
  organization?: string;
  detail?: string;
  description?: string;
  current?: boolean;
};
export type SaveAdminUserCareerInput = AdminUserCareerDto & { reason: string };
export type AdminUserPortfolioDto = {
  id: string;
  title: string;
  createdAt: string;
  summary: string;
  imageUrls: string[];
};
export type SaveAdminUserPortfolioInput = AdminUserPortfolioDto & {
  reason: string;
};
