import { Eye } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatCompactCount(value: number) {
  return value >= 1000
    ? `${Number((value / 1000).toFixed(1))}k`
    : String(value);
}

export function ViewCountMeta({
  count,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid h-8 grid-cols-[17px_auto] items-center gap-1 whitespace-nowrap leading-none text-[var(--fg-subtle)]",
        className,
      )}
      aria-label={`조회수 ${formatCompactCount(count ?? 0)}`}
    >
      <Eye size={17} strokeWidth={2} className="shrink-0" />
      <span className="text-[12px] leading-none tabular-nums text-[var(--fg-muted)]">
        {formatCompactCount(count ?? 0)}
      </span>
    </span>
  );
}
