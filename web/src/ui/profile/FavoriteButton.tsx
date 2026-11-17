"use client";

import { useState } from "react";

export function FavoriteButton() {
  const [favorite, setFavorite] = useState(false);

  return (
    <button
      type="button"
      aria-pressed={favorite}
      onClick={() => setFavorite((current) => !current)}
      className="min-h-14 rounded-[var(--radius-lg)] bg-[var(--accent)] text-[16px] font-bold text-white shadow-[var(--shadow-card)]"
    >
      {favorite ? "즐겨찾기 해제" : "즐겨찾기"}
    </button>
  );
}
