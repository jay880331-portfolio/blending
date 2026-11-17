export function normalizePlaceName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function formatCoordinateKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export function buildPlaceKey(name: string, lat: number, lng: number): string {
  const normalizedName = normalizePlaceName(name);
  const coord = formatCoordinateKey(lat, lng);
  return normalizedName ? `${normalizedName}@${coord}` : coord;
}

export type PlaceShowroomCandidate = {
  id: string;
  userId: string;
  storeName: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
};

export type PlaceProfileCandidate = {
  profileId?: string;
  workplace?: string;
  lat: number;
  lng: number;
};

/**
 * 장소(이름+좌표)에 속한 쇼룸을 찾는다.
 * 1) 쇼룸 좌표가 장소 좌표와 일치하는 경우 (소유자가 이 장소의 바리스타이거나 매장명이 일치할 때 우선)
 * 2) 소유자가 이 장소의 바리스타이고 매장명이 일치하는 경우
 */
export function matchShowroomToPlace<T extends PlaceShowroomCandidate>(
  showrooms: T[],
  profiles: PlaceProfileCandidate[],
  placeName: string,
  lat: number,
  lng: number,
): T | null {
  const ownerIds = new Set(
    profiles.map((p) => p.profileId).filter((id): id is string => Boolean(id)),
  );
  const normalizedPlace = normalizePlaceName(placeName);
  const targetCoord = formatCoordinateKey(lat, lng);

  const byOwnerAndCoord = showrooms.find(
    (s) =>
      ownerIds.has(s.userId) &&
      s.location &&
      formatCoordinateKey(s.location.latitude, s.location.longitude) ===
        targetCoord,
  );
  if (byOwnerAndCoord) return byOwnerAndCoord;

  const byOwnerAndName = showrooms.find(
    (s) =>
      ownerIds.has(s.userId) &&
      normalizedPlace.length > 0 &&
      normalizePlaceName(s.storeName) === normalizedPlace,
  );
  if (byOwnerAndName) return byOwnerAndName;

  const byCoordAndName = showrooms.find(
    (s) =>
      s.location &&
      formatCoordinateKey(s.location.latitude, s.location.longitude) ===
        targetCoord &&
      normalizedPlace.length > 0 &&
      normalizePlaceName(s.storeName) === normalizedPlace,
  );
  return byCoordAndName ?? null;
}
