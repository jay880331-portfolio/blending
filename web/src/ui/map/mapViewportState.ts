import { normalizeMapSearchQuery } from "@/ui/map/mapDirectory";

export function shouldShowMapEmptyState({
  profilesLoaded,
  filteredProfileCount,
}: {
  profilesLoaded: boolean;
  filteredProfileCount: number;
}) {
  return profilesLoaded && filteredProfileCount === 0;
}

export type MapLocationRequestIntent = "startup" | "recenter" | "refresh";

export function shouldCenterMapForLocationRequest({
  intent,
  hasKnownUserLocation,
  baristaFocused = false,
}: {
  intent: MapLocationRequestIntent;
  hasKnownUserLocation: boolean;
  baristaFocused?: boolean;
}) {
  if (baristaFocused && intent !== "recenter") return false;
  return intent !== "refresh" || !hasKnownUserLocation;
}

export function findOpenedMapBarista<
  T extends { profileId: string; lat: number; lng: number },
>(profiles: T[], baristaId: string): T | null {
  return (
    profiles.find(
      (profile) =>
        profile.profileId === baristaId &&
        Number.isFinite(profile.lat) &&
        Number.isFinite(profile.lng),
    ) ?? null
  );
}

export function findSearchedMapBaristaLocation<
  T extends {
    profileId: string;
    lat: number;
    lng: number;
    name?: string;
    workplace?: string;
    address?: string;
  },
>(profiles: T[], baristaId: string, query: string): T | null {
  const located = profiles.filter(
    (profile) =>
      profile.profileId === baristaId &&
      Number.isFinite(profile.lat) &&
      Number.isFinite(profile.lng),
  );
  if (located.length === 0) return null;

  const normalizedQuery = normalizeMapSearchQuery(query);
  if (!normalizedQuery) return located[0] ?? null;

  return (
    located.find((profile) =>
      [
        profile.workplace,
        profile.address,
        [profile.name, profile.workplace, profile.address]
          .filter((value): value is string => Boolean(value?.trim()))
          .join(" "),
      ].some((value) => value?.toLowerCase().includes(normalizedQuery)),
    ) ??
    located[0] ??
    null
  );
}

export function resolveOpenedMapProfile<T extends { id: string }>(
  selected: T | null,
  visible: T[],
): T | null {
  if (!selected) return null;
  return visible.find((profile) => profile.id === selected.id) ?? selected;
}

export function profilesForMapMarkers<T extends { id: string }>(
  visible: T[],
  selected: T | null,
): T[] {
  if (!selected || visible.some((profile) => profile.id === selected.id)) {
    return visible;
  }
  return [...visible, selected];
}

export function findUniqueSearchedMapProfile<
  T extends {
    profileId: string;
    lat: number;
    lng: number;
    name?: string;
    handle?: string;
  },
>(profiles: T[], query: string): T | null {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  const located = profiles.filter(
    (profile) => Number.isFinite(profile.lat) && Number.isFinite(profile.lng),
  );
  const exact = located.filter((profile) => {
    const name = profile.name?.trim().toLowerCase() ?? "";
    const handle = profile.handle?.trim().toLowerCase() ?? "";
    return name === normalized || (handle.length > 0 && handle === normalized);
  });
  const exactIds = new Set(exact.map((profile) => profile.profileId));
  if (exactIds.size === 1) return exact[0] ?? null;

  const ids = new Set(located.map((profile) => profile.profileId));
  if (ids.size === 1) return located[0] ?? null;
  return null;
}
