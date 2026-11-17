"use client";

import { Search, UserRound } from "lucide-react";

export function MapSearchBar({
  filteredCount,
  searchQuery,
  onDirectoryOpen,
  onSearchFocus,
  onSearchQueryChange,
}: {
  filteredCount: number;
  searchQuery: string;
  onDirectoryOpen: () => void;
  onSearchFocus?: () => void;
  onSearchQueryChange: (query: string) => void;
}) {
  return (
    <form
      role="search"
      aria-label="카페 또는 바리스타 검색"
      onSubmit={(event) => {
        event.preventDefault();
        onDirectoryOpen();
      }}
      className="flex h-12 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--surface)] px-4 shadow-[var(--shadow-card)]"
    >
      <label className="flex min-w-0 flex-1 items-center gap-3">
        <Search
          aria-hidden
          size={20}
          strokeWidth={2.1}
          className="h-5 w-5 shrink-0 text-[var(--fg-faint)]"
        />
        <span className="sr-only">카페 또는 바리스타 검색</span>
        <input
          type="search"
          value={searchQuery}
          placeholder="카페 또는 바리스타 검색"
          aria-label="카페 또는 바리스타 검색"
          enterKeyHint="search"
          onChange={(event) => onSearchQueryChange(event.target.value)}
          onFocus={onSearchFocus}
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium leading-none text-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)]"
        />
      </label>
      <button
        type="submit"
        aria-label={`검색 결과 ${filteredCount}명 목록 열기`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-pill)] transition active:scale-95"
      >
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--accent-soft)]"
        >
          <UserRound
            size={20}
            strokeWidth={1.9}
            className="h-5 w-5 text-[var(--accent)]"
          />
        </span>
      </button>
    </form>
  );
}
