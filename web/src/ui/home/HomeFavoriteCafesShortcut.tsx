"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Store } from "lucide-react";
import { fetchStoreFavorites } from "@/adapters/http/showroomApi";
import type { StoreFavoriteItem } from "@/domain/showroom/types";
import { HomeShortcutRow } from "@/ui/home/HomeShortcutRow";

export function HomeFavoriteCafesShortcut() {
  const [favorites, setFavorites] = useState<StoreFavoriteItem[] | null>(null);

  useEffect(() => {
    let active = true;
    let sequence = 0;

    async function refresh() {
      const request = ++sequence;
      try {
        const list = await fetchStoreFavorites();
        if (active && request === sequence) setFavorites(list);
      } catch {
        if (active && request === sequence) setFavorites([]);
      }
    }

    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  if (!favorites || favorites.length === 0) {
    return (
      <HomeShortcutRow
        href="/map"
        icon={<Store size={24} aria-hidden="true" />}
        title="찜한 카페"
        subtitle={favorites === null ? "확인 중" : "지도에서 찾기"}
      />
    );
  }

  return (
    <section
      aria-label="찜한 카페"
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--fg)]"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Store size={20} aria-hidden="true" />
          <span className="ds-h3">찜한 카페</span>
          <span className="ds-body text-[var(--fg-muted)] tabular-nums">
            {favorites.length}
          </span>
        </div>
        <Link
          href="/map"
          className="text-[12px] font-medium text-[var(--fg-muted)]"
        >
          지도 보기
        </Link>
      </div>

      <div className="mt-2.5 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {favorites.map((cafe) => (
          <Link
            key={cafe.storeId}
            href={`/showroom/${cafe.storeId}`}
            className="flex shrink-0 items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-alt)] px-3 py-2 text-[13px] font-bold text-[var(--fg-strong)] transition active:scale-[0.98]"
          >
            {cafe.hasActiveTimesale || cafe.hasActiveNotice ? (
              <span
                aria-hidden="true"
                className={`h-2 w-2 shrink-0 rounded-[var(--radius-pill)] ${
                  cafe.hasActiveTimesale
                    ? "bg-[var(--accent)]"
                    : "bg-[var(--fg-muted)]"
                }`}
              />
            ) : null}
            <span className="max-w-[140px] truncate">{cafe.storeName}</span>
            {cafe.hasActiveTimesale ? (
              <span className="text-[11px] font-bold text-[var(--accent)]">
                세일
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
