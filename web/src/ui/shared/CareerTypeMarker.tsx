import { Coffee, Star } from "lucide-react";

export function CareerTypeMarker({ type }: { type: "career" | "award" }) {
  if (type === "award") {
    return (
      <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--surface)]">
        <Star size={18} strokeWidth={2.2} fill="currentColor" />
      </span>
    );
  }

  return (
    <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--border-strong)] text-[var(--fg-muted)]">
      <Coffee size={18} strokeWidth={1.8} />
    </span>
  );
}
