import Link from "next/link";
import { ChevronLeft, UserRoundX } from "lucide-react";
import { BottomNav } from "@/ui/shared/BottomNav";

export default function ProfileNotFound() {
  return (
    <main className="min-h-screen bg-[var(--bg)] pb-28 text-[var(--fg)]">
      <header className="sticky top-0 z-20 flex h-[calc(76px_+_env(safe-area-inset-top))] items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-5 pt-[env(safe-area-inset-top)]">
        <Link
          href="/map"
          aria-label="지도 돌아가기"
          className="flex h-11 w-11 items-center justify-center text-[var(--fg)]"
        >
          <ChevronLeft size={26} strokeWidth={2.2} />
        </Link>
        <h1 className="logo-wordmark text-[24px] font-bold text-[var(--fg-strong)]">
          BLENDING
        </h1>
        <span aria-hidden className="h-11 w-11" />
      </header>

      <section className="flex min-h-[calc(100vh-180px)] flex-col items-center justify-center px-6 text-center">
        <UserRoundX
          size={38}
          strokeWidth={1.8}
          className="text-[var(--fg-subtle)]"
        />
        <h2 className="mt-4 text-[22px] font-bold leading-[1.35] text-[var(--fg-strong)]">
          프로필을 찾을 수 없습니다
        </h2>
        <p className="mt-3 text-[14px] leading-[1.7] text-[var(--fg-muted)]">
          삭제되었거나 더 이상 공개되지 않는 바리스타 프로필입니다.
        </p>
        <Link
          href="/map"
          className="mt-8 flex min-h-14 w-full max-w-[320px] items-center justify-center rounded-[var(--radius-lg)] bg-[var(--accent)] text-[18px] font-bold text-white shadow-[var(--shadow-card)]"
        >
          내 주변 바리스타 보기
        </Link>
      </section>

      <BottomNav active="map" />
    </main>
  );
}
