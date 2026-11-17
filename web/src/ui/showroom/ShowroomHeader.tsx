"use client";

import Link from "next/link";
import { ChevronLeft, Ticket } from "lucide-react";

export function ShowroomHeader({
  title = "바리스타 쇼룸",
  backHref = "/home",
  showCouponLink = true,
}: {
  title?: string;
  backHref?: string;
  showCouponLink?: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-[calc(60px_+_env(safe-area-inset-top))] items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-5 pt-[env(safe-area-inset-top)]">
      <Link
        href={backHref}
        aria-label="이전 화면으로 돌아가기"
        className="flex h-11 w-11 items-center justify-center text-[var(--fg)] transition active:scale-95"
      >
        <ChevronLeft size={24} strokeWidth={2.2} />
      </Link>
      <h1 className="text-[17px] font-bold text-[var(--fg-strong)] truncate max-w-[200px]">
        {title}
      </h1>
      <div className="flex items-center justify-end w-11">
        {showCouponLink ? (
          <Link
            href="/showroom/coupons"
            aria-label="내 쿠폰함 바로가기"
            className="flex h-11 w-11 items-center justify-center text-[var(--fg)] transition active:scale-95"
          >
            <Ticket size={22} strokeWidth={2} />
          </Link>
        ) : (
          <span aria-hidden className="w-11" />
        )}
      </div>
    </header>
  );
}
