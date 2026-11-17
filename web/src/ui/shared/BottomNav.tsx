"use client";

import Link from "next/link";

type BottomNavKey = "map" | "community" | "home" | "partner" | "mypage";
type BottomNavIcon =
  | "location_on"
  | "groups"
  | "home"
  | "local_cafe"
  | "person";

type BottomNavProps = {
  active: BottomNavKey;
};

const bottomNavItems: Array<{
  key: BottomNavKey;
  icon: BottomNavIcon;
  href: string;
  label: string;
}> = [
  { key: "map", icon: "location_on", href: "/map", label: "내주변" },
  {
    key: "community",
    icon: "groups",
    href: "/community/talk",
    label: "커뮤니티",
  },
  { key: "home", icon: "home", href: "/home", label: "홈" },
  {
    key: "partner",
    icon: "local_cafe",
    href: "/community/daily-note",
    label: "파트너",
  },
  { key: "mypage", icon: "person", href: "/mypage", label: "프로필" },
];

export function BottomNav({ active }: BottomNavProps) {
  return (
    <nav className="bottom-nav-shell fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[var(--app-shell-max-width)] border-t border-[var(--border)] bg-[var(--surface)]/95 px-5 pb-[calc(var(--app-safe-area-bottom)+10px)] pt-3 shadow-[var(--shadow-nav)] backdrop-blur-xl">
      <div className="relative z-[1] grid grid-cols-5 items-center">
        {bottomNavItems.map((item) => {
          const isActive = active === item.key;
          return (
            <Link
              href={item.href}
              key={item.key}
              prefetch={false}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={
                isActive
                  ? "bottom-nav-item bottom-nav-item-active"
                  : "bottom-nav-item"
              }
            >
              <span
                aria-hidden="true"
                className={[
                  "material-symbols-outlined text-[32px]",
                  isActive ? "filled" : "",
                ].join(" ")}
                style={
                  item.icon === "local_cafe"
                    ? {
                        clipPath: "inset(0 0 25% 0)",
                        transform: "translateY(3px)",
                      }
                    : undefined
                }
              >
                {item.icon}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
