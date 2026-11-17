"use client";

import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import type { BrewGuide } from "@/domain/brewGuide/brewGuide";
import { QrCode } from "@/ui/shared/QrCode";

function RecipeLine({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-[var(--border)] py-2.5 last:border-b-0">
      <span className="text-[13px] font-medium text-[var(--fg-muted)]">
        {label}
      </span>
      <span className="text-[15px] font-bold text-[var(--fg-strong)]">
        {value}
        {unit ? (
          <span className="ml-0.5 text-[12px] font-medium text-[var(--fg-muted)]">
            {unit}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function BrewGuideCardApp({ guide }: { guide: BrewGuide }) {
  const hasFilter = Boolean(guide.filter);
  const hasEspresso = Boolean(guide.espresso);
  const twoCols = hasFilter && hasEspresso;
  const canReserveBean = Boolean(guide.beanId && guide.beanActive);

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24 text-[var(--fg)]">
      <header className="flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4">
        <Link
          href={`/showroom/${encodeURIComponent(guide.storeId)}`}
          aria-label="쇼룸으로 돌아가기"
          className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--fg)] hover:bg-[var(--surface-alt)]"
        >
          <ArrowLeft size={20} />
        </Link>
        <span className="ds-label-caps text-[var(--fg-muted)]">BREW GUIDE</span>
        <span className="w-10" />
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <article className="rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] p-6">
          {/* 상단 카드 헤더 */}
          <div className="border-b-2 border-[var(--fg)] pb-4">
            <p className="ds-label-caps text-[var(--fg-muted)]">BREW GUIDE</p>
            <h1 className="mt-1.5 text-[24px] font-bold text-[var(--fg-strong)]">
              {guide.title}
            </h1>
          </div>

          {/* 본문: 좌 FILTER | 우 ESPRESSO (없는 쪽은 1단 확장) */}
          <div
            className={`grid gap-6 py-5 ${twoCols ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}
          >
            {guide.filter ? (
              <section>
                <h2 className="ds-label-caps mb-2 text-[var(--fg-strong)]">
                  FILTER
                </h2>
                <RecipeLine
                  label="원두량"
                  value={guide.filter.doseG}
                  unit="g"
                />
                <RecipeLine label="분쇄도" value={guide.filter.grind} />
                <RecipeLine
                  label="물 온도"
                  value={guide.filter.waterTempC}
                  unit="°C"
                />
                <RecipeLine
                  label="추출량"
                  value={guide.filter.yieldG}
                  unit="g"
                />
                <RecipeLine
                  label="추출 시간"
                  value={guide.filter.timeSec}
                  unit="초"
                />
              </section>
            ) : null}

            {guide.espresso ? (
              <section>
                <h2 className="ds-label-caps mb-2 text-[var(--fg-strong)]">
                  ESPRESSO
                </h2>
                <RecipeLine
                  label="원두량"
                  value={guide.espresso.doseG}
                  unit="g"
                />
                <RecipeLine
                  label="바스켓"
                  value={guide.espresso.basketG}
                  unit="g"
                />
                <RecipeLine
                  label="물 온도"
                  value={guide.espresso.waterTempC}
                  unit="°C"
                />
                <RecipeLine
                  label="추출량"
                  value={guide.espresso.yieldG}
                  unit="g"
                />
                <RecipeLine
                  label="추출 시간"
                  value={guide.espresso.timeSec}
                  unit="초"
                />
              </section>
            ) : null}
          </div>

          {/* 하단 고정 띠: 로스터리 · 바리스타 + 쇼룸 QR */}
          <footer className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] border-t border-[var(--border-strong)] bg-[var(--surface-alt)] px-4 py-3.5">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold text-[var(--fg-strong)]">
                {guide.storeName || "매장"}
              </p>
              <p className="mt-0.5 truncate text-[13px] text-[var(--fg-muted)]">
                {guide.authorName || "바리스타"}
                {guide.authorHandle ? ` (@${guide.authorHandle})` : ""}
              </p>
            </div>
            <div className="shrink-0">
              <QrCode
                value={(origin) => `${origin}/showroom/${guide.storeId}`}
                label={`${guide.storeName || "쇼룸"} QR`}
                size={84}
              />
            </div>
          </footer>
        </article>

        {/* 하단 액션: 이미지 저장 + (활성 원두 연결 시) 이 원두 재예약하기 */}
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <a
            href={`/api/brew-guides/${encodeURIComponent(guide.id)}/image?scale=2&download=1`}
            download={`brew-guide-${guide.id}.png`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-[14px] font-bold text-[var(--fg)] transition active:scale-95"
          >
            <Download size={16} />
            이미지 저장
          </a>
          {canReserveBean && guide.beanId ? (
            <Link
              href={`/showroom/${encodeURIComponent(guide.storeId)}?tab=beans&bean=${encodeURIComponent(guide.beanId)}`}
              className="flex flex-1 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-3 text-[14px] font-bold text-[var(--surface)] transition active:scale-95"
            >
              이 원두 재예약하기
            </Link>
          ) : null}
        </div>
      </main>
    </div>
  );
}
