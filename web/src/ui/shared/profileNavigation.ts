import type { ComponentProps } from "react";
import type { BottomNav } from "@/ui/shared/BottomNav";

type BottomNavActive = ComponentProps<typeof BottomNav>["active"];

export function buildProfileHref(profileId: string, returnTo: string) {
  return `/profile/${encodeURIComponent(profileId)}?${new URLSearchParams({ returnTo })}`;
}

export function profilePageNavigation(returnTo?: string): {
  backHref: string;
  active: BottomNavActive;
} {
  if (
    !returnTo ||
    !/^\/(?:community|partner|showroom|profile|map)(?:\/|$)/.test(returnTo) ||
    returnTo.startsWith("//")
  ) {
    return { backHref: "/map", active: "map" };
  }
  if (returnTo.startsWith("/community"))
    return { backHref: returnTo, active: "community" };
  if (returnTo.startsWith("/showroom"))
    return { backHref: returnTo, active: "map" };
  if (returnTo.startsWith("/partner"))
    return { backHref: returnTo, active: "partner" };
  if (returnTo.startsWith("/profile"))
    return { backHref: returnTo, active: "mypage" };
  return { backHref: returnTo, active: "map" };
}
