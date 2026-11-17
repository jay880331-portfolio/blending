import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

type HomeShortcutRowProps = {
  href: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
};

export function HomeShortcutRow({
  href,
  icon,
  title,
  subtitle,
}: HomeShortcutRowProps) {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--fg)]"
    >
      {icon}
      <span className="ds-h3">{title}</span>
      <span className="ds-body text-[var(--fg-muted)]" aria-live="polite">
        · {subtitle}
      </span>
      <ChevronRight size={20} className="ms-auto" aria-hidden="true" />
    </Link>
  );
}
