import Link from "next/link";
import { Trophy } from "lucide-react";
import type { CareerItem } from "@/domain/member/types";

// Restored from 48024f7ee012b0d36a8fd0fdb69b39eb867e385f
// web/src/ui/home/HomeApp.tsx CareerSection home award branch.
function careerTimelineYears(career: CareerItem) {
  const years = (
    career.year.match(/\d{4}/g) ??
    career.period.match(/\d{4}/g) ??
    []
  )
    .map(Number)
    .filter((year) => Number.isFinite(year));
  const start = years[0] ?? 0;
  return {
    start,
    end: years.at(-1) ?? start,
  };
}

function compareCareerTimeline(a: CareerItem, b: CareerItem) {
  const aYears = careerTimelineYears(a);
  const bYears = careerTimelineYears(b);
  return bYears.end - aYears.end || bYears.start - aYears.start;
}

export function AwardSection({
  careers,
  addHref,
}: {
  careers: CareerItem[];
  addHref?: string;
}) {
  const awards = careers
    .filter((item) => item.type === "award")
    .sort(compareCareerTimeline);

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)]">
          <Trophy size={15} />
        </span>
        <h2 className="text-[16px] font-bold text-[var(--fg-strong)]">
          수상 내역
        </h2>
        <span className="rounded-[var(--radius-sm)] bg-[var(--surface-alt)] px-2 py-0.5 text-[12px] font-medium text-[var(--fg-muted)]">
          {awards.length}건
        </span>
        {addHref ? (
          <Link
            prefetch={false}
            href={addHref}
            className="ml-auto flex h-11 items-center px-1 text-[12px] font-medium text-[var(--fg-muted)]"
          >
            + 추가
          </Link>
        ) : null}
      </div>
      <div className="mt-3 space-y-2">
        {awards.length ? (
          awards.map((award) => {
            const year = award.year.trim() || award.period.trim();
            const detail = (award.detail ?? award.description ?? "").trim();

            return (
              <article
                key={award.id}
                className="rounded-[var(--radius-lg)] border border-[var(--border)] border-l-[3px] border-l-[var(--fg)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[16px] font-bold text-[var(--fg-strong)]">
                      {award.title}
                    </h3>
                    {award.organization ? (
                      <p className="mt-1 text-[12px] font-bold text-[var(--info)]">
                        {award.organization}
                      </p>
                    ) : null}
                    {detail ? (
                      <p className="mt-1 text-[12px] text-[var(--fg-subtle)]">
                        {detail}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <span className="rounded-[var(--radius-sm)] px-2 py-1 text-[12px] font-bold bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)]">
                      {year}
                    </span>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] px-4 py-5 text-[12px] text-[var(--fg-muted)]">
            등록된 수상이 없습니다.
          </p>
        )}
      </div>
    </section>
  );
}
