import { NextResponse } from "next/server";
import type { WorkplaceLocation } from "@/domain/member/types";

type NaverGeocodeResponse = {
  addresses?: Array<{
    roadAddress?: string;
    jibunAddress?: string;
    englishAddress?: string;
    zipCode?: string;
    x?: string;
    y?: string;
  }>;
};

type NaverLocalSearchResponse = {
  items?: Array<{
    title?: string;
    address?: string;
    roadAddress?: string;
    mapx?: string;
    mapy?: string;
  }>;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() ?? "";
  if (!query) return NextResponse.json({ places: [] });

  const geocodeCredentials = getNaverGeocodeCredentials();
  const localCredentials = getNaverLocalCredentials();
  if (!geocodeCredentials && !localCredentials)
    return NextResponse.json(
      {
        places: [],
        message:
          "실제 주소 검색을 사용하려면 네이버 지도 Geocoding API 키가 필요합니다.",
      },
      { status: 503 },
    );

  try {
    const [localResult, geocodePlaces] = await Promise.all([
      localCredentials
        ? searchNaverLocal(query, localCredentials, geocodeCredentials)
            .then((places) => ({ places, available: true }))
            .catch(() => ({ places: [], available: false }))
        : Promise.resolve({ places: [], available: false }),
      geocodeCredentials
        ? searchNaverGeocode(query, geocodeCredentials).catch(() => [])
        : Promise.resolve([]),
    ]);
    const places = uniquePlaces([...localResult.places, ...geocodePlaces]);
    return NextResponse.json({
      places,
      message:
        places.length === 0 && !localResult.available
          ? "주소 검색은 가능하지만, 상호명 검색을 쓰려면 네이버 검색 API 키가 추가로 필요합니다."
          : undefined,
    });
  } catch {
    return NextResponse.json(
      {
        places: [],
        message:
          "주소 검색 서비스 요청에 실패했습니다. 잠시 후 다시 시도해주세요.",
      },
      { status: 502 },
    );
  }
}

function getNaverGeocodeCredentials() {
  const keyId =
    process.env.NAVER_MAPS_CLIENT_ID ??
    process.env.NAVER_MAP_CLIENT_ID ??
    process.env.NEXT_PUBLIC_NAVER_MAP_KEY_ID ??
    process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const key =
    process.env.NAVER_MAPS_CLIENT_SECRET ??
    process.env.NAVER_MAP_CLIENT_SECRET ??
    process.env.NAVER_MAPS_API_KEY;

  if (!keyId || !key) return null;
  return { keyId, key };
}

function getNaverLocalCredentials() {
  const keyId =
    process.env.NAVER_SEARCH_CLIENT_ID ??
    process.env.NAVER_LOCAL_CLIENT_ID ??
    process.env.NAVER_MAPS_CLIENT_ID ??
    process.env.NAVER_MAP_CLIENT_ID;
  const key =
    process.env.NAVER_SEARCH_CLIENT_SECRET ??
    process.env.NAVER_LOCAL_CLIENT_SECRET ??
    process.env.NAVER_MAPS_CLIENT_SECRET ??
    process.env.NAVER_MAP_CLIENT_SECRET;

  if (!keyId || !key) return null;
  return { keyId, key };
}

async function searchNaverLocal(
  query: string,
  credentials: { keyId: string; key: string },
  geocodeCredentials: { keyId: string; key: string } | null,
): Promise<WorkplaceLocation[]> {
  const response = await fetch(
    `https://naverapihub.apigw.ntruss.com/search/v1/local?query=${encodeURIComponent(query)}&display=5`,
    {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": credentials.keyId,
        "X-NCP-APIGW-API-KEY": credentials.key,
      },
      next: { revalidate: 60 * 60 * 24 },
    },
  );
  if (!response.ok) throw new Error("네이버 지역 검색 요청에 실패했습니다.");

  const data = (await response.json()) as NaverLocalSearchResponse;
  const places = (data.items ?? [])
    .map((item, index) => {
      const coordinates = parseNaverLocalCoordinates(item.mapx, item.mapy);
      const name = stripHtmlTags(item.title ?? "");
      const address = item.roadAddress || item.address || "";
      if (!coordinates || !name || !address) return null;

      return {
        id: `naver-local-${coordinates.lat}-${coordinates.lng}-${index}`,
        name,
        address,
        lat: coordinates.lat,
        lng: coordinates.lng,
        displayName: `${name} · ${address}`,
      } satisfies WorkplaceLocation;
    })
    .filter((item): item is WorkplaceLocation => Boolean(item));

  if (!geocodeCredentials) return places;
  return Promise.all(
    places.map(async (place) => ({
      ...place,
      postalCode:
        place.postalCode ??
        (await findNaverPostalCode(place.address, geocodeCredentials).catch(
          () => undefined,
        )),
    })),
  );
}

async function searchNaverGeocode(
  query: string,
  credentials: { keyId: string; key: string },
): Promise<WorkplaceLocation[]> {
  const response = await fetch(
    `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`,
    {
      headers: {
        "x-ncp-apigw-api-key-id": credentials.keyId,
        "x-ncp-apigw-api-key": credentials.key,
      },
      next: { revalidate: 60 * 60 * 24 },
    },
  );
  if (!response.ok) throw new Error("네이버 주소 검색 요청에 실패했습니다.");

  const data = (await response.json()) as NaverGeocodeResponse;
  return (data.addresses ?? [])
    .map((item, index) => {
      const address = item.roadAddress || item.jibunAddress || "";
      const lng = Number(item.x);
      const lat = Number(item.y);
      if (!address || !Number.isFinite(lat) || !Number.isFinite(lng))
        return null;

      const place: WorkplaceLocation = {
        id: `naver-${lat}-${lng}-${index}`,
        name: address,
        address,
        lat,
        lng,
        displayName: address,
      };
      if (item.zipCode) place.postalCode = item.zipCode;
      return place;
    })
    .filter((item): item is WorkplaceLocation => Boolean(item));
}

function parseNaverLocalCoordinates(mapx?: string, mapy?: string) {
  const lng = Number(mapx);
  const lat = Number(mapy);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  if (isLngLat(lng, lat)) return { lat, lng };

  const scaledLng = lng / 10_000_000;
  const scaledLat = lat / 10_000_000;
  if (isLngLat(scaledLng, scaledLat)) return { lat: scaledLat, lng: scaledLng };

  return null;
}

function isLngLat(lng: number, lat: number) {
  return Math.abs(lng) <= 180 && Math.abs(lat) <= 90;
}

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]*>/g, "").trim();
}

async function findNaverPostalCode(
  address: string,
  credentials: { keyId: string; key: string },
) {
  const [place] = await searchNaverGeocode(address, credentials);
  return place?.postalCode;
}

function uniquePlaces(places: WorkplaceLocation[]) {
  const byKey = new Map<string, WorkplaceLocation>();

  places.forEach((place) => {
    const key = `${place.name}-${place.address}`;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, place);
      return;
    }
    byKey.set(key, {
      ...current,
      postalCode: current.postalCode ?? place.postalCode,
      detailAddress: current.detailAddress ?? place.detailAddress,
    });
  });

  return Array.from(byKey.values());
}
