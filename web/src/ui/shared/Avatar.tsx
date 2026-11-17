"use client";

import Image from "next/image";
import { Component, type ReactNode } from "react";
import { OfficialAvatarBadge } from "./OfficialBadgeList";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const SIZE_CLASS = {
  sm: "h-12 w-12",
  md: "h-20 w-20",
  lg: "h-28 w-28",
  full: "h-full w-full",
  fluid: "aspect-square w-full",
} as const;

const SIZE_SIZES = {
  sm: "48px",
  md: "80px",
  lg: "112px",
  full: "(max-width: 480px) 100vw, 480px",
  fluid: "(max-width: 480px) 33vw, 120px",
} as const;

class AvatarImageBoundary extends Component<
  { resetKey?: string; fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prevProps: Readonly<{ resetKey?: string }>) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function AvatarFallback({ icon }: { icon?: ReactNode }) {
  if (icon) {
    return (
      <span className="flex h-full w-full items-center justify-center">
        {icon}
      </span>
    );
  }

  return (
    <>
      <span className="absolute left-1/2 top-1/2 h-px w-[140%] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[var(--fg-faint)]" />
      <span className="absolute left-1/2 top-1/2 h-px w-[140%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-[var(--fg-faint)]" />
    </>
  );
}

export function Avatar({
  src,
  alt = "",
  size = "md",
  loading,
  highlighted = false,
  dashed = false,
  badgeName,
  icon,
  className,
  children,
}: {
  src?: string;
  alt?: string;
  size?: "sm" | "md" | "lg" | "full" | "fluid";
  loading?: "eager" | "lazy";
  highlighted?: boolean;
  dashed?: boolean;
  badgeName?: string | null;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const imageSrc = src?.trim() || undefined;
  const isBlob = imageSrc?.startsWith("blob:");

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-visible rounded-[var(--radius-pill)] bg-[var(--surface-alt)] text-[var(--fg-muted)]",
        highlighted
          ? "border-2 border-[var(--accent)]"
          : dashed
            ? "border border-dashed border-[var(--border-strong)]"
            : "border border-[var(--border-strong)]",
        SIZE_CLASS[size],
        className,
      )}
    >
      <span className="absolute inset-0 overflow-hidden rounded-[var(--radius-pill)]">
        {imageSrc ? (
          <AvatarImageBoundary
            resetKey={imageSrc}
            fallback={<AvatarFallback icon={icon} />}
          >
            <Image
              src={imageSrc}
              alt={alt}
              fill
              unoptimized={isBlob}
              sizes={SIZE_SIZES[size]}
              className="object-cover"
              loading={loading}
            />
          </AvatarImageBoundary>
        ) : (
          <AvatarFallback icon={icon} />
        )}
      </span>
      {badgeName ? <OfficialAvatarBadge name={badgeName} /> : null}
      {children}
    </div>
  );
}
