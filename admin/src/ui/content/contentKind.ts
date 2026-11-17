import {
  ADMIN_CONTENT_KINDS,
  type AdminContentKind,
} from "@blending/admin-contracts";

export function isAdminContentKind(value: string): value is AdminContentKind {
  return ADMIN_CONTENT_KINDS.includes(value as AdminContentKind);
}

export function shouldRenderContentReactionSection(kind: AdminContentKind) {
  return kind !== "community_event" && kind !== "partner_banner";
}

export function commentParentKind(kind: AdminContentKind) {
  if (kind === "community_b_talk") return "b-talk";
  if (kind === "community_qa") return "qa";
  return null;
}

export function contentAuditLogsHref(kind: AdminContentKind, id: string) {
  return `/audit-logs?${new URLSearchParams({ resourceType: kind, resourceId: id })}`;
}

export function contentCommentsQuery(
  parentKind: "b-talk" | "qa",
  id: string,
  page: number,
) {
  return new URLSearchParams({
    parentKind,
    parentId: id,
    page: String(page),
  }).toString();
}
