import type { AdminUserRelatedKind } from "@blending/admin-contracts";

export type UserRelatedTab =
  | "profile"
  | "careers"
  | "badges"
  | "portfolios"
  | AdminUserRelatedKind;

const USER_RELATED_TABS = new Set<UserRelatedTab>([
  "profile",
  "careers",
  "badges",
  "portfolios",
  "activity",
  "favorites",
  "recipes",
  "notifications",
  "messages",
  "settings",
  "auth",
]);

export function parseUserRelatedQuery(query: string): {
  tab: UserRelatedTab;
  page: number;
} {
  const params = new URLSearchParams(query);
  const candidate = params.get("tab") as UserRelatedTab | null;
  const parsedPage = Number(params.get("page"));
  return {
    tab: candidate && USER_RELATED_TABS.has(candidate) ? candidate : "profile",
    page: Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

export function updateUserRelatedQuery(
  query: string,
  state: { tab: UserRelatedTab; page: number },
) {
  const params = new URLSearchParams(query);
  if (state.tab === "profile") params.delete("tab");
  else params.set("tab", state.tab);
  if (state.tab === "profile" || state.page <= 1) params.delete("page");
  else params.set("page", String(state.page));
  return params.toString();
}

export function userAuditLogsHref(userId: string) {
  const params = new URLSearchParams({ resourceId: userId });
  return `/audit-logs?${params}`;
}

export function auditLogDetailHref(auditId: string) {
  return `/audit-logs/${encodeURIComponent(auditId)}`;
}
