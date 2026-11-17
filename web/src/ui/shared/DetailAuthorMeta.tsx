import Image from "next/image";
import Link from "next/link";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function DetailAuthorMeta({
  name,
  date,
  avatarUrl,
  className,
  affiliation,
  isBarista = false,
  badge,
  profileHref,
  compact = false,
}: {
  name: string;
  date?: string;
  avatarUrl?: string;
  className?: string;
  affiliation?: string;
  isBarista?: boolean;
  badge?: string;
  profileHref?: string;
  compact?: boolean;
}) {
  const content = (
    <>
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-pill)] bg-[var(--surface-alt)] text-[14px] font-bold text-[var(--fg-muted)]",
          compact ? "h-8 w-8" : "h-11 w-11",
        )}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={`${name} 프로필 사진`}
            fill
            sizes={compact ? "32px" : "44px"}
            className="object-cover"
          />
        ) : (
          name.slice(0, 1)
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-bold leading-[1.4] text-[var(--fg-strong)]">
          {name}
          {isBarista ? (
            <span className="ml-1.5 rounded-[var(--radius-pill)] bg-[var(--fg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--surface)]">
              BARISTA
            </span>
          ) : null}
          {badge ? (
            <span className="ml-1.5 rounded-[var(--radius-pill)] bg-[var(--surface-alt)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--fg-muted)]">
              {badge}
            </span>
          ) : null}
        </span>
        {date ? (
          <span className="mt-0.5 block truncate text-[13px] leading-[1.4] text-[var(--fg-muted)]">
            {date}
          </span>
        ) : null}
        {affiliation ? (
          <span className="mt-0.5 block truncate text-[12px] leading-[1.4] text-[var(--fg-muted)]">
            {affiliation}
          </span>
        ) : null}
      </span>
    </>
  );
  return profileHref ? (
    <Link
      href={profileHref}
      aria-label={`${name} 프로필 보기`}
      className={cn("flex items-center gap-3", className)}
    >
      {content}
    </Link>
  ) : (
    <div className={cn("flex items-center gap-3", className)}>{content}</div>
  );
}
