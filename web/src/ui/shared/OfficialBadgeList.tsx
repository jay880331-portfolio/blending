import type {
  OfficialProfileBadge,
  ProfileBadgeIcon,
} from "@blending/admin-contracts";
import {
  Award,
  BadgeCheck,
  Briefcase,
  Coffee,
  Crown,
  Shield,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<ProfileBadgeIcon, LucideIcon> = {
  crown: Crown,
  coffee: Coffee,
  award: Award,
  star: Star,
  shield: Shield,
  briefcase: Briefcase,
  sparkles: Sparkles,
  "badge-check": BadgeCheck,
};

export function primaryOfficialBadge(
  badges: OfficialProfileBadge[] | undefined,
) {
  return badges?.[0] ?? null;
}

export function OfficialAvatarBadge({ name }: { name?: string | null }) {
  if (!name) return null;
  return (
    <span
      className={[
        "pointer-events-none absolute inset-x-0 top-[calc(100%-7px)] z-10 flex justify-center",
      ].join(" ")}
      style={{ transform: "translateY(-50%)" }}
    >
      <span
        className={[
          "flex max-w-20 shrink-0 items-center justify-center truncate rounded-[var(--radius-pill)] bg-[var(--accent)] px-2 font-bold text-[var(--surface)]",
          "h-[18px] text-[10px] leading-[18px]",
        ].join(" ")}
      >
        {name}
      </span>
    </span>
  );
}

export function OfficialBadgeChip({ badge }: { badge: OfficialProfileBadge }) {
  if (badge.imageUrl) {
    return (
      <span className="inline-flex h-8 max-w-[160px] items-center">
        <img
          src={badge.imageUrl}
          alt={badge.name}
          className="h-8 w-auto max-w-[160px] object-contain"
        />
      </span>
    );
  }
  const Icon = ICONS[badge.icon] ?? Award;
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--fg)] px-2 py-0.5 text-[12px] font-bold leading-4 text-[var(--surface)]">
      <Icon size={12} strokeWidth={2.2} aria-hidden />
      {badge.name}
    </span>
  );
}
