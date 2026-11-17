"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Store, Ticket, UserRound } from "lucide-react";
import type { BaristaShowroom } from "@/domain/showroom/types";
import { canWriteShowroom } from "@/domain/showroom/access";
import { fetchShowrooms } from "@/adapters/http/showroomApi";
import { ShowroomHeader } from "@/ui/showroom/ShowroomHeader";
import { EmptyState } from "@/ui/shared/EmptyState";
import { BottomNav } from "@/ui/shared/BottomNav";
import { TextTabBar } from "@/ui/shared/TextTabBar";

export function ShowroomListApp({
  initialSort = "latest",
  userRole,
}: {
  initialSort?: "latest" | "popular";
  userRole?: string;
}) {
  const [sort, setSort] = useState<"latest" | "popular">(initialSort);
  const [showrooms, setShowrooms] = useState<BaristaShowroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSortChange = (newSort: "latest" | "popular") => {
    if (newSort === sort) return;
    setSort(newSort);
    setLoading(true);
    setError(null);
  };

  useEffect(() => {
    let cancelled = false;
    fetchShowrooms(sort)
      .then((data) => {
        if (!cancelled) {
          setShowrooms(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "쇼룸을 불러오지 못했습니다.",
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sort]);

  return (
    <main className="min-h-screen bg-[var(--surface-alt)] pb-28 text-[var(--fg)]">
      <ShowroomHeader title="바리스타 쇼룸" backHref="/map" />

      {/* 상단 퀵 액션 카드 */}
      <section className="px-5 pt-4">
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--surface-alt)] text-[var(--accent)]">
              <Ticket size={20} />
            </div>
            <div>
              <p className="text-[14px] font-bold text-[var(--fg-strong)]">
                내 쿠폰함
              </p>
              <p className="text-[12px] text-[var(--fg-muted)]">
                담아둔 혜택과 타임세일 쿠폰 확인
              </p>
            </div>
          </div>
          <Link
            href="/showroom/coupons"
            className="shrink-0 rounded-[var(--radius-md)] bg-[var(--fg)] px-3 py-1.5 text-[12px] font-bold text-[var(--surface)] transition active:scale-95"
          >
            보기
          </Link>
        </div>

        {canWriteShowroom(userRole) ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--surface-alt)] text-[var(--fg-strong)]">
                <Store size={20} />
              </div>
              <div>
                <p className="text-[14px] font-bold text-[var(--fg-strong)]">
                  바리스타 쇼룸 관리
                </p>
                <p className="text-[12px] text-[var(--fg-muted)]">
                  대표 메뉴, 디지털 쿠폰 및 타임세일 푸시
                </p>
              </div>
            </div>
            <Link
              href="/showroom/manage"
              className="shrink-0 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[var(--fg)] transition active:scale-95"
            >
              관리
            </Link>
          </div>
        ) : null}
      </section>

      {/* 정렬 탭 */}
      <section className="mt-2">
        <TextTabBar
          ariaLabel="쇼룸 정렬"
          activeValue={sort}
          items={[
            { value: "latest", label: "최신 쇼룸" },
            { value: "popular", label: "인기 쇼룸" },
          ]}
          onChange={handleSortChange}
        />
      </section>

      {/* 쇼룸 목록 */}
      <section className="mt-4 px-5">
        {loading ? (
          <div className="py-12 text-center text-[14px] text-[var(--fg-muted)]">
            쇼룸 목록을 불러오는 중...
          </div>
        ) : error ? (
          <div className="py-12 text-center text-[14px] text-[var(--danger)]">
            {error}
          </div>
        ) : showrooms.length === 0 ? (
          <EmptyState
            title="등록된 바리스타 쇼룸이 없습니다"
            description="바리스타가 개설한 쇼룸이 곧 찾아옵니다."
          />
        ) : (
          <div className="space-y-3">
            {showrooms.map((sr) => (
              <Link
                key={sr.id}
                href={`/showroom/${sr.id}`}
                className="block rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] transition active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--surface-alt)]">
                    {sr.avatarUrl ? (
                      <Image
                        src={sr.avatarUrl}
                        alt={sr.baristaName || sr.storeName}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[var(--fg-muted)]">
                        <UserRound size={24} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[15px] font-bold text-[var(--fg-strong)]">
                        {sr.storeName}
                      </span>
                      <span className="rounded-[var(--radius-pill)] bg-[var(--surface-alt)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--fg-muted)] shrink-0">
                        {sr.baristaName || "바리스타"}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-[1.4] text-[var(--fg-muted)]">
                      {sr.bioMessage}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <BottomNav active="map" />
    </main>
  );
}
