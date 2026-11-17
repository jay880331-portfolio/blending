export const MAP_CLUSTER_ZOOM_THRESHOLD = 15;

export type MapMarkerProfile = {
  id: string;
  profileId?: string;
  workplace?: string;
  lat: number;
  lng: number;
};

export type MapMarkerGroup<T extends MapMarkerProfile> = {
  id: string;
  profiles: T[];
  lat: number;
  lng: number;
  clustered: boolean;
};

export function selectMapMarkerRepresentative<T extends { avatarUrl?: string }>(
  profiles: T[],
): T | undefined {
  return profiles.find((profile) => profile.avatarUrl) ?? profiles[0];
}

function coordinateKey(profile: MapMarkerProfile) {
  return `${profile.lat}:${profile.lng}`;
}

export function buildMapMarkerGroups<T extends MapMarkerProfile>(
  profiles: T[],
  zoom: number,
): Array<MapMarkerGroup<T>> {
  void zoom;

  const groups = new Map<string, T[]>();

  profiles.forEach((profile) => {
    const key = coordinateKey(profile);
    const groupProfiles = groups.get(key) ?? [];
    if (
      profile.profileId &&
      groupProfiles.some((item) => item.profileId === profile.profileId)
    )
      return;
    groups.set(key, [...groupProfiles, profile]);
  });

  return Array.from(groups.entries()).map(([key, groupProfiles]) => {
    const orderedProfiles = [...groupProfiles];
    const lat =
      orderedProfiles.reduce((sum, profile) => sum + profile.lat, 0) /
      orderedProfiles.length;
    const lng =
      orderedProfiles.reduce((sum, profile) => sum + profile.lng, 0) /
      orderedProfiles.length;

    return {
      id: `stack:${key}:${orderedProfiles
        .map((profile) => profile.id)
        .join(",")}`,
      profiles: orderedProfiles,
      lat,
      lng,
      clustered: false,
    };
  });
}
