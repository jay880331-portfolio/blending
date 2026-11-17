"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ImageIcon } from "lucide-react";

export type HomeThumbnailTile = { id: string; href: string; image: ReactNode };
const tileClassName =
  "aspect-square overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface-alt)]";

export function HomeThumbnailGrid({
  tiles,
  onReachEnd,
}: {
  tiles: HomeThumbnailTile[];
  onReachEnd: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="STORY 이미지 목록"
      tabIndex={0}
      className="grid grid-flow-col auto-cols-[calc((100%_-_1rem)/3)] gap-2 overflow-x-auto overscroll-x-contain snap-x snap-mandatory"
      onScroll={(event) => {
        const rail = event.currentTarget;
        if (rail.scrollWidth - rail.scrollLeft - rail.clientWidth <= 80)
          onReachEnd();
      }}
    >
      {tiles.map((tile) => (
        <Link
          prefetch={false}
          key={tile.id}
          href={tile.href}
          className={`${tileClassName} snap-start`}
        >
          {tile.image}
        </Link>
      ))}
      {Array.from({ length: Math.max(0, 3 - tiles.length) }, (_, index) => (
        <div
          key={`placeholder-${index}`}
          aria-hidden="true"
          className={`${tileClassName} flex items-center justify-center text-[var(--fg-faint)]`}
        >
          <ImageIcon size={24} />
        </div>
      ))}
    </div>
  );
}
