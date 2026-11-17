const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const HANGUL_INITIALS = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
] as const;

type DirectoryProfile = {
  id: string;
  name: string;
  handle?: string;
  workplace: string;
  workplaces?: string[];
  addresses?: string[];
  bio?: string;
  skills?: string[];
};

type DirectoryWorkplaceProfile = {
  name?: string;
  workplace: string;
  workplaces?: string[];
  addresses?: string[];
};

export type MapSearchableProfile = {
  name?: string;
  handle?: string;
  workplace?: string;
  workplaces?: string[];
  address?: string;
  addresses?: string[];
  bio?: string;
  skills?: string[];
};

export type BaristaDirectorySection<TProfile extends DirectoryProfile> = {
  initial: string;
  profiles: TProfile[];
};

export type BaristaDirectoryShuffleState = {
  roster: string[];
  remaining: string[];
};

export function createBaristaDirectoryShuffleState(
  profileIds: string[],
  random: () => number = Math.random,
): BaristaDirectoryShuffleState {
  const roster = uniqueProfileIds(profileIds);

  return { roster, remaining: shuffleProfileIds(roster, random) };
}

export function reconcileBaristaDirectoryShuffleState(
  profileIds: string[],
  savedState: unknown,
  random: () => number = Math.random,
): BaristaDirectoryShuffleState {
  const roster = uniqueProfileIds(profileIds);
  if (!isShuffleState(savedState)) {
    return { roster, remaining: shuffleProfileIds(roster, random) };
  }

  const currentProfileIds = new Set(roster);
  const priorProfileIds = new Set(savedState.roster);
  const remaining = savedState.remaining.filter((id) =>
    currentProfileIds.has(id),
  );
  const addedProfileIds = roster.filter((id) => !priorProfileIds.has(id));

  return {
    roster,
    remaining: [...remaining, ...shuffleProfileIds(addedProfileIds, random)],
  };
}

export function orderBaristaDirectoryProfiles<
  TProfile extends { profileId: string },
>(profiles: TProfile[], remainingIds: string[]) {
  const profilesById = new Map<string, TProfile>();
  for (const profile of profiles) {
    if (!profilesById.has(profile.profileId))
      profilesById.set(profile.profileId, profile);
  }

  const remainingSet = new Set<string>();
  const ordered: TProfile[] = [];
  for (const profileId of remainingIds) {
    const profile = profilesById.get(profileId);
    if (!profile || remainingSet.has(profileId)) continue;
    remainingSet.add(profileId);
    ordered.push(profile);
  }
  for (const profile of profilesById.values()) {
    if (!remainingSet.has(profile.profileId)) ordered.push(profile);
  }

  return ordered;
}

export function rotateBaristaDirectoryProfiles<T>(
  profiles: T[],
  start: number,
) {
  if (profiles.length === 0) return [];

  const offset =
    ((start % profiles.length) + profiles.length) % profiles.length;

  return Array.from(
    { length: profiles.length },
    (_, index) => profiles[(offset + index) % profiles.length]!,
  );
}

export function advanceBaristaDirectoryRandomWindowStart(
  windowStart: number,
  visibleCount: number,
  leavingRandomMode: boolean,
  totalProfileCount = Number.POSITIVE_INFINITY,
) {
  if (!leavingRandomMode) return windowStart;

  const nextWindowStart = windowStart + visibleCount;
  return nextWindowStart >= totalProfileCount ? 0 : nextWindowStart;
}

export function getHorizontalScrollIndicatorGeometry(
  clientWidth: number,
  scrollWidth: number,
  scrollLeft: number,
) {
  if (clientWidth <= 0 || scrollWidth <= 0) return { offset: 0, thumbWidth: 0 };
  if (scrollWidth <= clientWidth) return { offset: 0, thumbWidth: clientWidth };

  const thumbWidth = (clientWidth * clientWidth) / scrollWidth;
  const maxOffset = clientWidth - thumbWidth;
  const maxScrollLeft = scrollWidth - clientWidth;
  const progress =
    Math.min(Math.max(scrollLeft, 0), maxScrollLeft) / maxScrollLeft;

  return { offset: maxOffset * progress, thumbWidth };
}

export function buildBaristaDirectorySections<
  TProfile extends DirectoryProfile,
>(profiles: TProfile[], query: string): BaristaDirectorySection<TProfile>[] {
  const filteredProfiles = profiles
    .filter((profile) => matchesMapSearch(profile, query))
    .sort((left, right) =>
      left.name.localeCompare(right.name, "ko-KR", { numeric: true }),
    );

  const sections = new Map<string, TProfile[]>();
  filteredProfiles.forEach((profile) => {
    const initial = getBaristaDirectoryInitial(profile.name);
    sections.set(initial, [...(sections.get(initial) ?? []), profile]);
  });

  return Array.from(sections.entries())
    .map(([initial, sectionProfiles]) => ({
      initial,
      profiles: sectionProfiles,
    }))
    .sort((left, right) =>
      left.initial.localeCompare(right.initial, "ko-KR", { numeric: true }),
    );
}

export function normalizeMapSearchQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

export function matchesMapSearch(profile: MapSearchableProfile, query: string) {
  const normalizedQuery = normalizeMapSearchQuery(query);
  if (!normalizedQuery) return true;

  return mapSearchContexts(profile).some((searchText) =>
    searchText.toLowerCase().includes(normalizedQuery),
  );
}

export function getDirectoryMatchedWorkplace(
  profile: DirectoryWorkplaceProfile,
  query: string,
) {
  const normalizedQuery = normalizeMapSearchQuery(query);
  if (!normalizedQuery) return profile.workplace;

  const matchedLocation = mapSearchLocations(profile).find((location) => {
    const locationContext = [profile.name, location.workplace, location.address]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(" ");

    return [location.workplace, location.address, locationContext].some(
      (value) => value.toLowerCase().includes(normalizedQuery),
    );
  });

  return matchedLocation?.workplace || profile.workplace;
}

function mapSearchContexts(profile: MapSearchableProfile): string[] {
  const locations = mapSearchLocations(profile);
  if (locations.length === 0) {
    return [
      [profile.name, profile.handle, profile.bio, ...(profile.skills ?? [])]
        .filter((value): value is string => Boolean(value?.trim()))
        .join(" "),
    ];
  }

  return locations.map((location) =>
    [
      profile.name,
      location.workplace,
      location.address,
      profile.handle,
      profile.bio,
      ...(profile.skills ?? []),
    ]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(" "),
  );
}

function mapSearchLocations(profile: MapSearchableProfile) {
  const workplaces =
    profile.workplaces && profile.workplaces.length > 0
      ? profile.workplaces
      : profile.workplace
        ? [profile.workplace]
        : [];
  const addresses =
    profile.addresses && profile.addresses.length > 0
      ? profile.addresses
      : profile.address
        ? [profile.address]
        : [];
  const locationCount = Math.max(workplaces.length, addresses.length);

  return Array.from({ length: locationCount }, (_, index) => ({
    workplace: workplaces[index]?.trim() ?? "",
    address: addresses[index]?.trim() ?? "",
  }));
}

export function getKoreanInitial(value: string) {
  const firstChar = value.trim().charAt(0);
  const code = firstChar.charCodeAt(0);

  if (code >= HANGUL_BASE && code <= HANGUL_END) {
    const initialIndex = Math.floor((code - HANGUL_BASE) / 588);
    return HANGUL_INITIALS[initialIndex] ?? "#";
  }

  return firstChar.toUpperCase() || "#";
}

export function getBaristaDirectoryInitial(value: string) {
  const initial = getKoreanInitial(value);

  if (initial === "ㄲ") return "ㄱ";
  if (initial === "ㄸ") return "ㄷ";
  if (initial === "ㅃ") return "ㅂ";
  if (initial === "ㅆ") return "ㅅ";
  if (initial === "ㅉ") return "ㅈ";
  if (HANGUL_INITIALS.includes(initial as (typeof HANGUL_INITIALS)[number]))
    return initial;
  if (/^[A-Z]$/.test(initial)) return "A–Z";

  return "#";
}

export function getDirectoryProfileHref(profileId: string) {
  return `/profile/${encodeURIComponent(profileId)}`;
}

function uniqueProfileIds(profileIds: string[]) {
  return Array.from(new Set(profileIds));
}

function shuffleProfileIds(profileIds: string[], random: () => number) {
  const shuffled = [...profileIds];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[nextIndex]] = [
      shuffled[nextIndex]!,
      shuffled[index]!,
    ];
  }

  return shuffled;
}

function isShuffleState(value: unknown): value is BaristaDirectoryShuffleState {
  if (!value || typeof value !== "object") return false;

  const { roster, remaining } = value as Partial<BaristaDirectoryShuffleState>;
  if (
    !Array.isArray(roster) ||
    !Array.isArray(remaining) ||
    !roster.every((id) => typeof id === "string") ||
    !remaining.every((id) => typeof id === "string") ||
    new Set(roster).size !== roster.length ||
    new Set(remaining).size !== remaining.length
  )
    return false;

  const rosterIds = new Set(roster);
  return remaining.every((id) => rosterIds.has(id));
}
