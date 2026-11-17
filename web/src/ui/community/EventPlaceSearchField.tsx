"use client";

import { useEffect, useState } from "react";
import { Check, MapPin, Search } from "lucide-react";
import { getPlaceSearchUrl } from "@/ui/community/EventLocationMap";

type EventPlace = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

type EventPlaceSearchResponse = {
  places?: EventPlace[];
  message?: string;
};

export function getEventPlaceInitialQuery(location: string, address: string) {
  const normalizedLocation = location.trim();
  return normalizedLocation && normalizedLocation !== "장소 미정"
    ? normalizedLocation
    : address.trim();
}

export function EventPlaceSearchField({
  location,
  address,
  onLocationChange,
  onAddressChange,
}: {
  location: string;
  address: string;
  onLocationChange: (value: string) => void;
  onAddressChange: (value: string) => void;
}) {
  const hasInitialSelection = Boolean(
    location.trim() && location.trim() !== "장소 미정" && address.trim(),
  );
  const [query, setQuery] = useState(() =>
    getEventPlaceInitialQuery(location, address),
  );
  const [searching, setSearching] = useState(false);
  const [searchActive, setSearchActive] = useState(!hasInitialSelection);
  const [searched, setSearched] = useState(false);
  const [places, setPlaces] = useState<EventPlace[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const normalizedQuery = query.trim();
  const hasSelection = Boolean(
    !searchActive &&
    location.trim() &&
    location.trim() !== "장소 미정" &&
    address.trim(),
  );

  useEffect(() => {
    if (!searchActive || normalizedQuery.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      setMessage(null);

      fetch(getPlaceSearchUrl(normalizedQuery), { signal: controller.signal })
        .then(async (response) => {
          const data = (await response.json()) as EventPlaceSearchResponse;
          if (!response.ok)
            throw new Error(data.message || "장소 검색에 실패했습니다.");
          return data;
        })
        .then((data) => {
          setPlaces(data.places ?? []);
          setMessage(data.message ?? null);
          setSearched(true);
          setSearching(false);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setPlaces([]);
          setMessage(
            error instanceof Error
              ? error.message
              : "장소 검색에 실패했습니다.",
          );
          setSearched(true);
          setSearching(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedQuery, searchActive]);

  const changeQuery = (value: string) => {
    setQuery(value);
    setSearchActive(true);
    setPlaces([]);
    setSearching(false);
    setSearched(false);
    setMessage(null);
    if (location || address) {
      onLocationChange("");
      onAddressChange("");
    }
  };

  const selectPlace = (place: EventPlace) => {
    setQuery(place.name);
    setPlaces([]);
    setMessage(null);
    setSearched(false);
    setSearchActive(false);
    onLocationChange(place.name);
    onAddressChange(place.address);
  };

  return (
    <div>
      <label className="flex min-h-12 items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-strong)] px-4 focus-within:border-[var(--accent)]">
        <Search size={19} className="shrink-0 text-[var(--fg-subtle)]" />
        <input
          type="search"
          value={query}
          onChange={(event) => changeQuery(event.target.value)}
          aria-label="장소명 또는 주소 검색"
          autoComplete="off"
          placeholder="장소명 또는 주소를 검색하세요"
          className="min-w-0 flex-1 bg-transparent py-3 text-[16px] text-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)]"
        />
      </label>

      {hasSelection ? (
        <div className="mt-3 flex gap-3 border-t border-[var(--border)] pt-3">
          <MapPin
            size={18}
            className="mt-0.5 shrink-0 text-[var(--fg-muted)]"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-[var(--fg-strong)]">
              {location}
            </p>
            <p className="mt-1 text-[12px] leading-5 text-[var(--fg-muted)]">
              {address}
            </p>
          </div>
          <Check size={18} className="shrink-0 text-[var(--success)]" />
        </div>
      ) : normalizedQuery.length > 0 && normalizedQuery.length < 2 ? (
        <p className="mt-3 text-[12px] text-[var(--fg-muted)]">
          2글자 이상 입력해 주세요.
        </p>
      ) : searching ? (
        <p className="mt-3 text-[12px] text-[var(--fg-muted)]">
          장소를 검색하고 있습니다.
        </p>
      ) : places.length > 0 ? (
        <div className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {places.map((place) => (
            <button
              key={place.id}
              type="button"
              onClick={() => selectPlace(place)}
              className="flex min-h-14 w-full items-start gap-3 py-3 text-left active:bg-[var(--surface-alt)]"
            >
              <MapPin
                size={18}
                className="mt-0.5 shrink-0 text-[var(--fg-muted)]"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold text-[var(--fg-strong)]">
                  {place.name}
                </span>
                <span className="mt-1 block text-[12px] leading-5 text-[var(--fg-muted)]">
                  {place.address}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : searched ? (
        <p
          role={message ? "alert" : "status"}
          className="mt-3 text-[12px] leading-5 text-[var(--fg-muted)]"
        >
          {message ||
            "검색 결과가 없습니다. 다른 장소명이나 주소로 찾아보세요."}
        </p>
      ) : null}
    </div>
  );
}
