"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Pencil,
  QrCode as QrIcon,
} from "lucide-react";
import {
  PASSPORT_DECAF_LABEL,
  PASSPORT_FLAVORS,
  PASSPORT_FLAVOR_LABELS,
  PASSPORT_MENUS,
  PASSPORT_MENU_LABELS,
  type CoffeePassport,
  type PassportFlavor,
  type PassportMenu,
} from "@/domain/passport/passport";
import {
  fetchPassportSummary,
  saveMyPassport,
} from "@/adapters/http/passportApi";
import type { PassportSummaryData } from "@/domain/passport/types";
import type { BeanReservation } from "@/domain/showroom/bean";
import { toKstDateKey } from "@/domain/passport/ledger";
import {
  fetchMemberReservationsApi,
  transitionBeanReservationApi,
} from "@/adapters/http/beanApi";
import {
  PassportPresentation,
  type PassportPresentationRequest,
} from "@/ui/passport/PassportPresentation";
import { BottomNav } from "@/ui/shared/BottomNav";
import { Button } from "@/ui/shared/Button";
import { Chip } from "@/ui/shared/Chip";
import { EmptyState } from "@/ui/shared/EmptyState";

export function PassportApp({
  initialPassport,
}: {
  initialPassport: CoffeePassport | null;
}) {
  const [passport, setPassport] = useState<CoffeePassport | null>(
    initialPassport,
  );
  const [editing, setEditing] = useState(!initialPassport);
  const [flavor, setFlavor] = useState<PassportFlavor>(
    initialPassport?.flavor ?? "acidity",
  );
  const [menus, setMenus] = useState<PassportMenu[]>(
    initialPassport?.menus ?? ["americano"],
  );
  const [decaf, setDecaf] = useState<boolean>(initialPassport?.decaf ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PassportSummaryData | null>(null);
  const [reservations, setReservations] = useState<BeanReservation[]>([]);
  const [presentationReq, setPresentationReq] =
    useState<PassportPresentationRequest | null>(null);
  const [redeemStoreId, setRedeemStoreId] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const data = await fetchPassportSummary();
      setSummary(data);
    } catch {
      // 요약 조회 실패 시 기존 상태 유지
    }
  }, []);

  useEffect(() => {
    if (!passport || editing) return;
    let cancelled = false;
    fetchPassportSummary()
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {});
    fetchMemberReservationsApi()
      .then((list) => {
        if (!cancelled) setReservations(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [editing, passport]);

  const toggleMenu = (menu: PassportMenu) => {
    setMenus((current) =>
      current.includes(menu)
        ? current.filter((item) => item !== menu)
        : [...current, menu],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (menus.length === 0) {
      setError("자주 마시는 메뉴를 1개 이상 선택해주세요.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const saved = await saveMyPassport({ flavor, menus, decaf });
      setPassport(saved);
      setEditing(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "커피 여권을 저장하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto min-h-[100dvh] max-w-[var(--app-shell-max-width)] bg-[var(--bg)] pb-28 text-[var(--fg)]">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4">
        <Link
          href="/home"
          aria-label="홈으로 돌아가기"
          className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] text-[var(--fg)] transition active:scale-95"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="ds-h2 text-[var(--fg-strong)]">커피 여권</h1>
      </header>

      <main className="px-6 py-6">
        {presentationReq ? (
          <PassportPresentation
            request={presentationReq}
            onCompleted={() => {
              void loadSummary();
            }}
            onClose={() => {
              setPresentationReq(null);
              setRedeemStoreId(null);
              void loadSummary();
            }}
          />
        ) : passport && !editing ? (
          <div className="space-y-6">
            <section className="ds-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BookOpen
                    size={20}
                    className="text-[var(--fg)]"
                    aria-hidden="true"
                  />
                  <h2 className="ds-h2 text-[var(--fg-strong)]">
                    내 커피 여권
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFlavor(passport.flavor);
                    setMenus(passport.menus);
                    setDecaf(passport.decaf);
                    setError(null);
                    setEditing(true);
                  }}
                  className="flex items-center gap-1 rounded-[var(--radius-lg)] border border-[var(--border-strong)] px-3 py-1.5 text-[13px] font-medium text-[var(--fg)] transition active:scale-95"
                >
                  <Pencil size={14} aria-hidden="true" />
                  수정
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <p className="ds-label text-[var(--fg-muted)]">선호 풍미</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <Chip selected>
                      {PASSPORT_FLAVOR_LABELS[passport.flavor]}
                    </Chip>
                  </div>
                </div>

                <div>
                  <p className="ds-label text-[var(--fg-muted)]">
                    자주 마시는 메뉴
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {passport.menus.map((item) => (
                      <Chip key={item}>{PASSPORT_MENU_LABELS[item]}</Chip>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="ds-label text-[var(--fg-muted)]">디카페인</p>
                  <p className="mt-1 ds-body text-[var(--fg-strong)]">
                    {passport.decaf ? PASSPORT_DECAF_LABEL : "일반 카페인 선호"}
                  </p>
                </div>
              </div>

              <p className="mt-5 border-t border-[var(--border)] pt-3 text-[12px] text-[var(--fg-muted)] tabular-nums">
                발급일 {new Date(passport.issuedAt).toLocaleDateString("ko-KR")}
              </p>
            </section>

            <Button
              variant="primary"
              onClick={() => setPresentationReq({ purpose: "STAMP" })}
            >
              <QrIcon size={18} aria-hidden="true" />
              스탬프 받기
            </Button>

            <section className="ds-card">
              <div className="flex items-baseline justify-between">
                <h3 className="ds-h3 text-[var(--fg-strong)]">보유 포인트</h3>
                <span className="ds-h1 tabular-nums text-[var(--fg-strong)]">
                  {(summary?.balance ?? 0).toLocaleString("ko-KR")}P
                </span>
              </div>
              <p className="mt-1 ds-body-s text-[var(--fg-muted)] tabular-nums">
                누적 스탬프 {summary?.totalStamps ?? 0}개 · 스탬프 1회 +100P,
                방문 인증 리뷰 +50P
              </p>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="ds-h3 text-[var(--fg-strong)]">
                  스탬프 찍은 매장
                </h3>
                <Link
                  href="/map"
                  className="text-[12px] font-medium text-[var(--fg-muted)]"
                >
                  지도에서 찾기
                </Link>
              </div>
              {!summary || summary.stampedStores.length === 0 ? (
                <EmptyState
                  title="아직 스탬프 기록이 없습니다."
                  description="매장에서 스탬프 받기 QR을 보여주세요."
                />
              ) : (
                <div className="space-y-3">
                  {summary.stampedStores.map((store) => {
                    const expanded = redeemStoreId === store.storeId;
                    return (
                      <div key={store.storeId} className="ds-card space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              href={`/showroom/${store.storeId}`}
                              className="block truncate text-[15px] font-bold text-[var(--fg-strong)]"
                            >
                              {store.storeName}
                            </Link>
                            <p className="mt-0.5 text-[12px] text-[var(--fg-muted)] tabular-nums">
                              스탬프 {store.stampCount}회 · 최근 방문{" "}
                              {store.latestKstDate}
                            </p>
                            {store.businessVerified === false ? (
                              <p className="mt-0.5 text-[11px] font-medium text-[var(--fg-muted)]">
                                사업자 인증 대기
                              </p>
                            ) : null}
                          </div>
                          {store.exchangeableMenus.length > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setRedeemStoreId(
                                  expanded ? null : store.storeId,
                                )
                              }
                              className="shrink-0 rounded-[var(--radius-lg)] border border-[var(--border-strong)] px-3 py-1.5 text-[12px] font-bold text-[var(--fg)] transition active:scale-95"
                            >
                              음료 교환
                            </button>
                          ) : null}
                        </div>

                        {expanded ? (
                          <div className="space-y-2 border-t border-[var(--border)] pt-3">
                            {store.exchangeableMenus.map((menu) => {
                              const enough =
                                (summary?.balance ?? 0) >= menu.exchangePoints;
                              return (
                                <div
                                  key={menu.id}
                                  className="flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-[13px] font-medium text-[var(--fg-strong)]">
                                      {menu.name}
                                    </p>
                                    <p className="text-[12px] text-[var(--fg-muted)] tabular-nums">
                                      {menu.exchangePoints.toLocaleString(
                                        "ko-KR",
                                      )}
                                      P
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={!enough}
                                    onClick={() =>
                                      setPresentationReq({
                                        purpose: "REDEEM",
                                        storeId: store.storeId,
                                        storeName: store.storeName,
                                        menuId: menu.id,
                                        menuName: menu.name,
                                        points: menu.exchangePoints,
                                      })
                                    }
                                    className="shrink-0 rounded-[var(--radius-md)] border border-[var(--border-strong)] px-3 py-1.5 text-[12px] font-bold text-[var(--fg)] disabled:opacity-40"
                                  >
                                    {enough ? "교환 QR" : "포인트 부족"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="ds-h3 text-[var(--fg-strong)]">포인트 내역</h3>
              {!summary || summary.recentLedger.length === 0 ? (
                <EmptyState title="포인트 내역이 없습니다." />
              ) : (
                <div className="divide-y divide-[var(--border)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4">
                  {summary.recentLedger.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-[var(--fg-strong)]">
                          {entry.type === "STAMP"
                            ? "스탬프 적립"
                            : entry.type === "REVIEW"
                              ? "방문 인증 리뷰"
                              : "음료 교환"}{" "}
                          · {entry.storeName}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[var(--fg-muted)] tabular-nums">
                          {new Date(entry.createdAt).toLocaleDateString(
                            "ko-KR",
                          )}
                          {entry.expiresAt && (entry.remaining ?? 0) > 0
                            ? ` · ${new Date(entry.expiresAt).toLocaleDateString("ko-KR")} 만료`
                            : ""}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-[14px] font-bold tabular-nums ${
                          entry.amount > 0
                            ? "text-[var(--fg-strong)]"
                            : "text-[var(--fg-muted)]"
                        }`}
                      >
                        {entry.amount > 0 ? `+${entry.amount}` : entry.amount}P
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section id="reservations" className="space-y-3">
              <h3 className="ds-h3 text-[var(--fg-strong)]">
                내 원두·드립백 예약
              </h3>
              {reservations.length === 0 ? (
                <EmptyState title="원두·드립백 예약 내역이 없습니다." />
              ) : (
                <div className="space-y-2.5">
                  {reservations.map((resv) => {
                    const canCancel =
                      (resv.status === "REQUESTED" ||
                        resv.status === "CONFIRMED") &&
                      toKstDateKey() < resv.pickupDate;
                    return (
                      <div key={resv.id} className="ds-card space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              href={`/showroom/${resv.storeId}?tab=beans`}
                              className="block truncate text-[14px] font-bold text-[var(--fg-strong)]"
                            >
                              {resv.storeName || "매장"} ·{" "}
                              {resv.beanSnapshot.name}
                            </Link>
                            <p className="mt-0.5 text-[12px] text-[var(--fg-muted)] tabular-nums">
                              {resv.quantity}개 · 픽업 {resv.pickupDate} ·{" "}
                              {(
                                resv.beanSnapshot.price * resv.quantity
                              ).toLocaleString("ko-KR")}
                              원
                            </p>
                          </div>
                          <span className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-bold text-[var(--fg-strong)]">
                            {resv.status === "REQUESTED"
                              ? "요청 중"
                              : resv.status === "CONFIRMED"
                                ? "확정됨"
                                : resv.status === "REJECTED"
                                  ? "거절됨"
                                  : resv.status === "PICKED_UP"
                                    ? "픽업 완료"
                                    : "취소됨"}
                          </span>
                        </div>
                        {canCancel ? (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const updated =
                                    await transitionBeanReservationApi(
                                      resv.id,
                                      "CANCELLED",
                                    );
                                  setReservations((prev) =>
                                    prev.map((item) =>
                                      item.id === resv.id ? updated : item,
                                    ),
                                  );
                                } catch (err) {
                                  alert(
                                    err instanceof Error
                                      ? err.message
                                      : "취소에 실패했습니다.",
                                  );
                                }
                              }}
                              className="rounded-[var(--radius-md)] border border-[var(--border-strong)] px-3 py-1 text-[12px] font-bold text-[var(--fg-muted)]"
                            >
                              예약 취소
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            <section>
              <h2 className="ds-h2 text-[var(--fg-strong)]">
                1. 어떤 풍미를 좋아하시나요?
              </h2>
              <p className="mt-1 ds-body-s text-[var(--fg-muted)]">
                가장 선호하는 한 가지를 선택해주세요.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {PASSPORT_FLAVORS.map((item) => (
                  <Chip
                    key={item.value}
                    selected={flavor === item.value}
                    onClick={() => setFlavor(item.value)}
                  >
                    {item.label}
                  </Chip>
                ))}
              </div>
            </section>

            <section>
              <h2 className="ds-h2 text-[var(--fg-strong)]">
                2. 자주 마시는 메뉴는 무엇인가요?
              </h2>
              <p className="mt-1 ds-body-s text-[var(--fg-muted)]">
                1개 이상 선택할 수 있습니다.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {PASSPORT_MENUS.map((item) => (
                  <Chip
                    key={item.value}
                    selected={menus.includes(item.value)}
                    onClick={() => toggleMenu(item.value)}
                  >
                    {item.label}
                  </Chip>
                ))}
              </div>
            </section>

            <section>
              <h2 className="ds-h2 text-[var(--fg-strong)]">
                3. 디카페인을 선호하시나요?
              </h2>
              <p className="mt-1 ds-body-s text-[var(--fg-muted)]">
                디카페인 원두를 찾는 경우 선택해주세요.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Chip
                  selected={decaf}
                  onClick={() => setDecaf((prev) => !prev)}
                  leading={
                    decaf ? <Check size={14} aria-hidden="true" /> : undefined
                  }
                >
                  {PASSPORT_DECAF_LABEL}
                </Chip>
              </div>
            </section>

            {error ? (
              <p className="text-[13px] font-medium text-[var(--danger)]">
                {error}
              </p>
            ) : null}

            <div className="space-y-3 pt-2">
              <Button
                type="submit"
                variant="primary"
                disabled={saving || menus.length === 0}
                pending={saving}
              >
                {passport ? "취향 저장" : "여권 발급"}
              </Button>
              {passport ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setError(null);
                    setEditing(false);
                  }}
                >
                  취소
                </Button>
              ) : null}
            </div>
          </form>
        )}
      </main>

      <BottomNav active="home" />
    </div>
  );
}
