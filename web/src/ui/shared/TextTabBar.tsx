"use client";

import Link from "next/link";

type TextTabItem<Value extends string> = {
  value: Value;
  label: string;
  count?: number;
  href?: string;
};

type TextTabBarProps<Value extends string> = {
  items: Array<TextTabItem<Value>>;
  activeValue: Value;
  ariaLabel: string;
  onChange?: (value: Value) => void;
};

function tabClass(active: boolean) {
  return [
    "flex h-full items-center gap-2 whitespace-nowrap transition-colors",
    active
      ? "font-bold text-[var(--accent)]"
      : "font-normal text-[var(--fg-subtle)]",
  ].join(" ");
}

export function TextTabBar<Value extends string>({
  items,
  activeValue,
  ariaLabel,
  onChange,
}: TextTabBarProps<Value>) {
  return (
    <nav
      aria-label={ariaLabel}
      className="scrollbar-none flex h-14 items-center gap-9 overflow-x-auto px-6 text-[16px] leading-[1.4]"
    >
      {items.map((item) => {
        const active = item.value === activeValue;
        const content = (
          <>
            <span>{item.label}</span>
            {typeof item.count === "number" ? (
              <span className="tabular-nums">{item.count}</span>
            ) : null}
          </>
        );

        if (item.href) {
          return (
            <Link
              key={item.value}
              href={item.href}
              prefetch={false}
              className={tabClass(active)}
              aria-current={active ? "page" : undefined}
            >
              {content}
            </Link>
          );
        }

        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange?.(item.value)}
            className={tabClass(active)}
            aria-pressed={active}
          >
            {content}
          </button>
        );
      })}
    </nav>
  );
}
