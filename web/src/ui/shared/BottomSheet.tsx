import type { ReactNode } from "react";

type BottomSheetProps = {
  children: ReactNode;
  className?: string;
  zIndexClass?: string;
  bottomOffset?: "nav" | "none";
  scrollable?: boolean;
};

export function BottomSheet({
  children,
  className = "",
  zIndexClass = "z-30",
  bottomOffset = "nav",
  scrollable = false,
}: BottomSheetProps) {
  const bottomClass =
    bottomOffset === "nav"
      ? "bottom-[var(--app-bottom-nav-height)]"
      : "bottom-0";
  const scrollClass = scrollable
    ? "flex max-h-[55dvh] flex-col overflow-hidden"
    : "";

  return (
    <section
      className={`absolute inset-x-0 ${bottomClass} ${zIndexClass} mx-auto max-w-[var(--app-shell-max-width)] rounded-t-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] px-5 pb-3 pt-2 shadow-[var(--shadow-modal)] transition duration-200 ease-out ${scrollClass} ${className}`.trim()}
    >
      <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-[var(--radius-pill)] bg-[var(--border-strong)]" />
      {children}
    </section>
  );
}
