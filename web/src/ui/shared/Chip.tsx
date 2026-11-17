import type { ReactNode } from "react";

type ChipProps = {
  children: ReactNode;
  selected?: boolean;
  leading?: ReactNode;
  onClick?: () => void;
  className?: string;
};

export function Chip({
  children,
  selected = false,
  leading,
  onClick,
  className = "",
}: ChipProps) {
  const stateClass = selected
    ? "border-[var(--fg)] bg-[var(--fg)] font-bold text-[var(--surface)]"
    : "border-[var(--border-strong)] bg-[var(--surface)] font-medium text-[var(--fg-muted)]";
  const paddingClass = leading ? "px-2.5 pr-3" : "px-3";
  const baseClass =
    `flex h-8 shrink-0 items-center gap-2 rounded-[var(--radius-pill)] border ${paddingClass} text-[12px] shadow-[var(--shadow-card)] ${stateClass} ${className}`.trim();

  if (onClick) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={onClick}
        className={baseClass}
      >
        {leading}
        {children}
      </button>
    );
  }

  return (
    <span className={baseClass}>
      {leading}
      {children}
    </span>
  );
}
