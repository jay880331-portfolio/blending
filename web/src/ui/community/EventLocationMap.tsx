"use client";

import { useEffect, useRef, useState } from "react";
import { isNativeBridgeAvailable, nativeBridge } from "@/bridge/nativeBridge";
import {
  loadNaverMaps,
  type NaverMapInstance,
  type NaverMapsApi,
} from "@/ui/shared/naverMap";

type Place = {
  name: string;
  address: string;
  lat: number;
  lng: number;
};

const NAVER_MAP_KEY_ID =
  process.env.NEXT_PUBLIC_NAVER_MAP_KEY_ID ??
  process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
const NAVER_MAP_APP_NAME = "com.blending.app";

function eventLocationSearchQuery(location: string, address: string) {
  return [location === "장소 미정" ? "" : location, address]
    .filter(Boolean)
    .join(" ");
}

export function getNaverMapSearchUrl(location: string, address: string) {
  return `https://map.naver.com/p/search/${encodeURIComponent(
    eventLocationSearchQuery(location, address),
  )}`;
}

export function getNaverMapAppSearchUrl(location: string, address: string) {
  return `nmap://search?query=${encodeURIComponent(
    eventLocationSearchQuery(location, address),
  )}&appname=${NAVER_MAP_APP_NAME}`;
}

export async function openNaverMapInNativeApp(
  url: string,
  openExternalUrl: (input: { url: string }) => Promise<unknown>,
) {
  await openExternalUrl({ url });
}

export function getPlaceSearchUrl(address: string) {
  return `/api/places/search?query=${encodeURIComponent(address)}`;
}

export function getEventLocationMapKey(location: string, address: string) {
  return JSON.stringify([location, address]);
}

export function isEventLocationMapVisible(
  loadedLocationKey: string | null,
  locationKey: string,
) {
  return loadedLocationKey === locationKey;
}

export function synchronizeEventLocationMapSize(
  map: Pick<NaverMapInstance, "setSize">,
  element: {
    getBoundingClientRect: () => { width: number; height: number };
  },
  maps: Pick<NaverMapsApi["maps"], "Size">,
) {
  const { width, height } = element.getBoundingClientRect();
  if (!width || !height) return;

  map.setSize?.(new maps.Size(width, height));
}

export function EventLocationMap({
  location,
  address,
}: {
  location: string;
  address: string;
}) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const [loadedLocationKey, setLoadedLocationKey] = useState<string | null>(
    null,
  );
  const nativeBridgeAvailable = isNativeBridgeAvailable();
  const searchUrl = nativeBridgeAvailable
    ? getNaverMapAppSearchUrl(location, address)
    : getNaverMapSearchUrl(location, address);
  const locationKey = getEventLocationMapKey(location, address);
  const hasMap = isEventLocationMapVisible(loadedLocationKey, locationKey);

  useEffect(() => {
    const query = address || location;
    if (!query || !NAVER_MAP_KEY_ID) return;

    let mounted = true;
    let resizeObserver: ResizeObserver | undefined;
    let synchronizeMapSize: (() => void) | undefined;
    Promise.all([
      fetch(getPlaceSearchUrl(query))
        .then(async (response) => {
          if (!response.ok) return null;
          const { places } = (await response.json()) as { places?: Place[] };
          const [place] = places ?? [];
          return place &&
            Number.isFinite(place.lat) &&
            Number.isFinite(place.lng)
            ? place
            : null;
        })
        .catch(() => null),
      loadNaverMaps(NAVER_MAP_KEY_ID),
    ])
      .then(([place]) => {
        if (!mounted || !place || !mapElementRef.current || !window.naver?.maps)
          return;

        const maps = window.naver.maps;
        const position = new maps.LatLng(place.lat, place.lng);
        const mapElement = mapElementRef.current;
        const map = new maps.Map(mapElement, {
          center: position,
          logoControl: false,
          mapDataControl: false,
          scaleControl: false,
          zoom: 15,
          zoomControl: false,
        });
        new maps.Marker({ map, position });
        synchronizeMapSize = () =>
          synchronizeEventLocationMapSize(map, mapElement, maps);
        synchronizeMapSize();
        window.addEventListener("resize", synchronizeMapSize);
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(synchronizeMapSize);
          resizeObserver.observe(mapElement);
        }
        setLoadedLocationKey(locationKey);
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
      resizeObserver?.disconnect();
      if (synchronizeMapSize) {
        window.removeEventListener("resize", synchronizeMapSize);
      }
    };
  }, [address, location, locationKey]);

  return (
    <section className="mt-4">
      <div
        ref={mapElementRef}
        aria-label="일정 장소 지도"
        className={`h-44 overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface-alt)] ${
          hasMap ? "" : "invisible"
        }`}
      />
      <a
        href={searchUrl}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => {
          if (!nativeBridgeAvailable) return;

          event.preventDefault();
          void openNaverMapInNativeApp(searchUrl, (input) =>
            nativeBridge.openExternalUrl(input),
          );
        }}
        className="mt-3 inline-flex text-[14px] font-bold text-[var(--fg)] underline underline-offset-4"
      >
        네이버 지도에서 장소 보기
      </a>
    </section>
  );
}
