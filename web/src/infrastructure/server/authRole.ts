import type { MemberRole } from "../../domain/member/types";

export function hasAdminRole(user: { role?: MemberRole } | null) {
  return user?.role === "admin";
}

export function canSendMapMessage(user: { role?: MemberRole } | null) {
  return canExchangeDirectMessage(user);
}

export function canReceiveDirectMessage(user: { role?: MemberRole } | null) {
  return canExchangeDirectMessage(user);
}

function canExchangeDirectMessage(user: { role?: MemberRole } | null) {
  return (
    user?.role === "admin" ||
    user?.role === "barista" ||
    user?.role === "partner"
  );
}
