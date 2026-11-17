"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { BottomNav } from "@/ui/shared/BottomNav";
import { HeaderIconActions } from "@/ui/shared/HeaderIconActions";
import { StoryTabs } from "@/ui/shared/StoryTabs";
import { TextTabBar } from "@/ui/shared/TextTabBar";

type CommunityShellTab =
  | "talk-enthusiast"
  | "talk-barista"
  | "calendar"
  | "daily-note"
  | "pick"
  | "recipe"
  | "qa";

export function CommunityShell({
  activeTab,
  view,
  headerAction,
  hideTabs = false,
  bottomNavActive,
  children,
}: {
  activeTab: CommunityShellTab;
  view: string[];
  headerAction?: ReactNode;
  hideTabs?: boolean;
  bottomNavActive?: ComponentProps<typeof BottomNav>["active"];
  children: ReactNode;
}) {
  const router = useRouter();
  const dailyNoteSide = activeTab === "daily-note" || activeTab === "pick";
  const showBack =
    view[0] !== "calendar" && view.length > 1 && activeTab !== "pick";

  return (
    <div className="min-h-screen bg-[var(--surface-alt)]">
      <div className="relative mx-auto min-h-screen max-w-[var(--app-shell-max-width)] bg-[var(--bg)] shadow-[0_0_0_1px_var(--border)]">
        <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div
            className={[
              "grid h-16 items-center px-2",
              showBack
                ? "grid-cols-[56px_1fr_56px]"
                : "grid-cols-[84px_1fr_84px]",
            ].join(" ")}
          >
            {showBack ? (
              <button
                type="button"
                aria-label="뒤로가기"
                onClick={() => router.back()}
                className="flex h-11 w-11 items-center justify-center text-[var(--fg)]"
              >
                <ArrowLeft size={24} strokeWidth={2} />
              </button>
            ) : (
              <div aria-hidden className="h-11 w-11" />
            )}
            <Link
              href={
                dailyNoteSide ? "/community/daily-note" : "/community/calendar"
              }
              className="logo-wordmark text-center text-[25px] font-bold text-[var(--fg-strong)]"
            >
              BLENDING
            </Link>
            <div
              className={[
                "flex h-11 items-center justify-center",
                showBack ? "w-11" : "w-[84px]",
              ].join(" ")}
            >
              {headerAction ??
                (!showBack ? (
                  <HeaderIconActions
                    searchHref="/home/search"
                    loadUnreadNotifications
                  />
                ) : null)}
            </div>
          </div>
          {hideTabs ? null : dailyNoteSide ? (
            <StoryTabs active={activeTab === "pick" ? "pick" : "daily-note"} />
          ) : (
            <TextTabBar
              ariaLabel="커뮤니티 탭"
              activeValue={activeTab}
              items={[
                {
                  value: "talk-enthusiast",
                  label: "애호가 토크",
                  href: "/community/talk/enthusiast",
                },
                {
                  value: "talk-barista",
                  label: "바리스타 토크",
                  href: "/community/talk/barista",
                },
                {
                  value: "calendar",
                  label: "CALENDAR",
                  href: "/community/calendar",
                },
                { value: "qa", label: "Q&A", href: "/community/qa" },
              ]}
            />
          )}
        </header>
        <main className="pb-28">{children}</main>
        <BottomNav
          active={bottomNavActive ?? (dailyNoteSide ? "partner" : "community")}
        />
      </div>
    </div>
  );
}
