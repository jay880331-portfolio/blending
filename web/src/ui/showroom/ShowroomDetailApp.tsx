"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  Flag,
  MapPin,
  Megaphone,
  MessageSquare,
  Settings,
  Ticket,
  UserRound,
  X,
} from "lucide-react";
import type { BrewGuide } from "@/domain/brewGuide/brewGuide";
import type { ShowroomDetailData } from "@/domain/showroom/types";
import {
  addKstDays,
  BEAN_GRIND_LABELS,
  RESERVATION_MAX_DAYS_AHEAD,
  RESERVATION_MAX_QUANTITY,
  RESERVATION_MIN_QUANTITY,
  RESERVATION_NOTE_MAX_LENGTH,
  type BeanGrindOption,
  type ShowroomBean,
} from "@/domain/showroom/bean";
import {
  REVIEW_MAX_LENGTH,
  REVIEW_MIN_LENGTH,
  toKstDateKey,
} from "@/domain/passport/ledger";
import { matchStoreTags } from "@/domain/passport/match";
import { getActiveStatusNotice } from "@/domain/showroom/statusNotice";
import { selectActiveTimesaleCoupons } from "@/domain/showroom/timesaleActive";
import type { StoreReviewItem } from "@/domain/passport/types";
import {
  createBeanReservationApi,
  fetchStoreBeans,
} from "@/adapters/http/beanApi";
import { fetchStoreBrewGuides } from "@/adapters/http/brewGuideApi";
import {
  createStoreReview,
  fetchStoreReviews,
} from "@/adapters/http/passportApi";
import {
  claimShowroomCoupon,
  fetchShowroomDetail,
  toggleStoreFavorite,
} from "@/adapters/http/showroomApi";
import { ShowroomHeader } from "@/ui/showroom/ShowroomHeader";
import { BottomNav } from "@/ui/shared/BottomNav";
import { BottomSheet } from "@/ui/shared/BottomSheet";
import { Button } from "@/ui/shared/Button";
import { Chip } from "@/ui/shared/Chip";
import { EmptyState } from "@/ui/shared/EmptyState";
import { FavoriteStarIcon } from "@/ui/shared/FavoriteStarIcon";
import { ReportDialog } from "@/ui/shared/ReportDialog";
import { TextTabBar } from "@/ui/shared/TextTabBar";
import { CouponTerms } from "./CouponTerms";

export function ShowroomDetailApp({
  showroomId,
  initialData,
}: {
  showroomId: string;
  initialData?: ShowroomDetailData;
}) {
  const searchParams = useSearchParams();
  const highlightCouponId = searchParams.get("coupon");
  const initialTab = searchParams.get("tab") === "beans" ? "beans" : "drinks";
  const initialBeanId = searchParams.get("bean");

  const [activeTab, setActiveTab] = useState<"drinks" | "beans">(initialTab);
  const [data, setData] = useState<ShowroomDetailData | null>(
    initialData ?? null,
  );
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [reviews, setReviews] = useState<StoreReviewItem[]>([]);
  const [canWriteReview, setCanWriteReview] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewBody, setReviewBody] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reportingReview, setReportingReview] =
    useState<StoreReviewItem | null>(null);
  const [beans, setBeans] = useState<ShowroomBean[]>([]);
  const [brewGuides, setBrewGuides] = useState<BrewGuide[]>([]);
  const [selectedBean, setSelectedBean] = useState<ShowroomBean | null>(null);
  const [reserveGrind, setReserveGrind] = useState<BeanGrindOption | null>(
    null,
  );
  const [reserveQuantity, setReserveQuantity] = useState(1);
  const [reservePickupDate, setReservePickupDate] = useState(() =>
    toKstDateKey(),
  );
  const [reserveNote, setReserveNote] = useState("");
  const [submittingReservation, setSubmittingReservation] = useState(false);
  const [reservationDoneMessage, setReservationDoneMessage] = useState<
    string | null
  >(null);

  const couponRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const claimRequests = useRef<Record<string, string>>({});

  useEffect(() => {
    if (initialData) return;
    let cancelled = false;
    fetchShowroomDetail(showroomId)
      .then((res) => {
        if (!cancelled) {
          setData(res);
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
  }, [showroomId, initialData]);

  // 딥링크 쿠폰 하이라이트 스크롤
  useEffect(() => {
    if (highlightCouponId && data && couponRefs.current[highlightCouponId]) {
      couponRefs.current[highlightCouponId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [highlightCouponId, data]);

  useEffect(() => {
    if (!data?.showroom.id) return;
    let cancelled = false;
    fetchStoreReviews(data.showroom.id)
      .then((res) => {
        if (!cancelled) {
          setReviews(res.reviews);
          setCanWriteReview(res.canWriteReview);
        }
      })
      .catch(() => {});
    fetchStoreBeans(data.showroom.id)
      .then((list) => {
        if (cancelled) return;
        setBeans(list);
        if (initialBeanId) {
          const matched = list.find((b) => b.id === initialBeanId);
          if (matched) {
            setActiveTab("beans");
            setSelectedBean(matched);
            setReserveGrind(
              matched.kind === "bean"
                ? (matched.grindOptions[0] ?? null)
                : null,
            );
          }
        }
      })
      .catch(() => {});
    fetchStoreBrewGuides(data.showroom.id)
      .then((guides) => {
        if (!cancelled) setBrewGuides(guides);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [data?.showroom.id, initialBeanId]);

  const openBeanSheet = (bean: ShowroomBean) => {
    setSelectedBean(bean);
    setReserveGrind(
      bean.kind === "bean" ? (bean.grindOptions[0] ?? null) : null,
    );
    setReserveQuantity(1);
    setReservePickupDate(toKstDateKey());
    setReserveNote("");
    setReservationDoneMessage(null);
  };

  const handleSubmitReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !selectedBean || submittingReservation) return;
    setSubmittingReservation(true);
    try {
      await createBeanReservationApi(data.showroom.id, {
        beanId: selectedBean.id,
        grind: selectedBean.kind === "bean" ? reserveGrind : null,
        quantity: reserveQuantity,
        pickupDate: reservePickupDate,
        note: reserveNote,
      });
      setSelectedBean(null);
      setReservationDoneMessage("사장님께 알림을 보냈어요. 결제는 매장에서.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "예약 신청에 실패했습니다.");
    } finally {
      setSubmittingReservation(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || submittingReview) return;
    setSubmittingReview(true);
    try {
      await createStoreReview(data.showroom.id, reviewBody);
      setReviewBody("");
      setShowReviewForm(false);
      const refreshed = await fetchStoreReviews(data.showroom.id);
      setReviews(refreshed.reviews);
      setCanWriteReview(refreshed.canWriteReview);
      setToastMessage("방문 인증 리뷰 등록! +50P가 적립되었습니다.");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "리뷰 등록에 실패했습니다.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleClaim = async (couponId: string) => {
    if (claimingId) return;
    setClaimingId(couponId);
    try {
      claimRequests.current[couponId] ??= crypto.randomUUID();
      await claimShowroomCoupon(couponId, claimRequests.current[couponId]);
      delete claimRequests.current[couponId];
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          coupons: prev.coupons.map((c) =>
            c.id === couponId
              ? {
                  ...c,
                  claimed: true,
                  claimedCount: (c.claimedCount ?? (c.claimed ? 1 : 0)) + 1,
                }
              : c,
          ),
        };
      });
      setToastMessage("쿠폰함에 담았습니다! 매장에서 사용해보세요.");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "쿠폰 담기에 실패했습니다.");
    } finally {
      setClaimingId(null);
    }
  };

  const handleToggleFavorite = async () => {
    if (!data || savingFavorite) return;
    const nextFavorited = !data.isFavorited;
    setSavingFavorite(true);
    try {
      await toggleStoreFavorite(data.showroom.id, nextFavorited);
      setData((prev) =>
        prev ? { ...prev, isFavorited: nextFavorited } : prev,
      );
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "매장 찜 상태를 변경하지 못했습니다.",
      );
    } finally {
      setSavingFavorite(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--surface-alt)] pb-28 text-[var(--fg)]">
        <ShowroomHeader title="쇼룸 불러오는 중..." backHref="/map" />
        <div className="py-20 text-center text-[14px] text-[var(--fg-muted)]">
          쇼룸 정보를 불러오고 있습니다...
        </div>
        <BottomNav active="map" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-[var(--surface-alt)] pb-28 text-[var(--fg)]">
        <ShowroomHeader title="바리스타 쇼룸" backHref="/map" />
        <div className="py-20 text-center text-[14px] text-[var(--danger)]">
          {error || "쇼룸을 찾을 수 없습니다."}
        </div>
        <BottomNav active="map" />
      </main>
    );
  }

  const { showroom, menus, coupons, isOwner, isFavorited, viewerPassport } =
    data;
  const activeNotice = getActiveStatusNotice(showroom.statusNotice);
  const activeTimesales = selectActiveTimesaleCoupons(coupons);
  const tasteMatch = matchStoreTags(viewerPassport, showroom.tasteProfile);

  return (
    <main className="min-h-screen bg-[var(--surface-alt)] pb-28 text-[var(--fg)]">
      <ShowroomHeader
        title={showroom.storeName}
        backHref="/map"
        showCouponLink
      />

      {toastMessage ? (
        <div className="fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-[var(--radius-pill)] bg-[var(--fg)] px-4 py-2 text-[13px] font-medium text-[var(--surface)] shadow-[var(--shadow-modal)] transition">
          {toastMessage}
        </div>
      ) : null}

      {/* 바리스타 프로필 & 소속 매장 카드 */}
      <section className="px-5 pt-4">
        <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--surface-alt)]">
              {showroom.avatarUrl ? (
                <Image
                  src={showroom.avatarUrl}
                  alt={showroom.baristaName || showroom.storeName}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[var(--fg-muted)]">
                  <UserRound size={32} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[18px] font-bold text-[var(--fg-strong)]">
                  {showroom.storeName}
                </h2>
              </div>
              <p className="mt-0.5 text-[13px] font-medium text-[var(--fg-muted)]">
                바리스타 {showroom.baristaName || ""}
              </p>
              {showroom.location?.address ? (
                <p className="mt-1 flex items-center gap-1 text-[12px] text-[var(--fg-muted)]">
                  <MapPin size={13} className="shrink-0" />
                  <span className="truncate">{showroom.location.address}</span>
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                aria-label={isFavorited ? "매장 찜 해제" : "매장 찜하기"}
                aria-pressed={Boolean(isFavorited)}
                disabled={savingFavorite}
                onClick={() => void handleToggleFavorite()}
                className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-strong)] text-[var(--accent)] transition active:scale-95 disabled:opacity-60"
              >
                <FavoriteStarIcon filled={Boolean(isFavorited)} size={18} />
              </button>
              {isOwner ? (
                <Link
                  href="/showroom/manage"
                  aria-label="쇼룸 관리"
                  className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-strong)] text-[var(--fg)] transition active:scale-95"
                >
                  <Settings size={18} />
                </Link>
              ) : null}
            </div>
          </div>

          {activeNotice ? (
            <div className="mt-4 flex items-start gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-alt)] px-3.5 py-2.5">
              <Megaphone
                size={15}
                className="mt-0.5 shrink-0 text-[var(--fg-muted)]"
                aria-hidden="true"
              />
              <p className="text-[13px] font-medium leading-[1.45] text-[var(--fg-strong)]">
                {activeNotice.text}
              </p>
            </div>
          ) : null}

          {/* 한줄 소식 */}
          <div className="mt-3 rounded-[var(--radius-lg)] bg-[var(--surface-alt)] p-3.5">
            <p className="text-[13px] leading-[1.5] text-[var(--fg)]">
              {showroom.bioMessage}
            </p>
          </div>

          {showroom.businessVerified ||
          tasteMatch.matched ||
          tasteMatch.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {showroom.businessVerified ? (
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--surface-alt)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--fg-strong)]">
                  <CheckCircle2 size={12} aria-hidden="true" />
                  인증 매장
                </span>
              ) : null}
              {tasteMatch.matched ? (
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--fg)] bg-[var(--fg)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--surface)]">
                  <CheckCircle2 size={12} aria-hidden="true" />내 취향과 맞음
                </span>
              ) : null}
              {tasteMatch.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--fg-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {activeTimesales.length > 0 ? (
        <section className="mt-3 px-5">
          <div className="space-y-2">
            {activeTimesales.map((coupon) => (
              <Link
                key={coupon.id}
                href={`/showroom/${showroom.id}?coupon=${encodeURIComponent(coupon.id)}`}
                onClick={() => {
                  couponRefs.current[coupon.id]?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                }}
                className="flex items-center justify-between gap-2 rounded-[var(--radius-lg)] border border-[var(--accent)] bg-[var(--surface)] px-4 py-3 text-[13px] transition active:scale-[0.99]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 rounded-[var(--radius-pill)] bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-[var(--surface)]">
                    타임세일
                  </span>
                  <span className="truncate font-bold text-[var(--fg-strong)]">
                    {coupon.title}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] font-bold text-[var(--accent)]">
                  확인하기
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-4 border-b border-[var(--border)] bg-[var(--surface)]">
        <TextTabBar
          ariaLabel="쇼룸 탭"
          items={[
            { value: "drinks", label: "대표 음료" },
            { value: "beans", label: "원두·드립백 예약", count: beans.length },
          ]}
          activeValue={activeTab}
          onChange={(value) => setActiveTab(value as "drinks" | "beans")}
        />
      </div>

      {activeTab === "beans" ? (
        <section className="mt-6 px-5">
          {reservationDoneMessage ? (
            <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] p-4 text-[13px] font-medium text-[var(--fg-strong)]">
              {reservationDoneMessage}
              <Link
                href="/passport#reservations"
                className="ml-2 font-bold underline"
              >
                내 예약 보기
              </Link>
            </div>
          ) : null}

          {!showroom.businessVerified ? (
            <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-alt)] p-3.5 text-[12px] text-[var(--fg-muted)]">
              사업자 인증이 완료된 매장만 원두 예약을 받을 수 있습니다.
            </div>
          ) : null}

          {beans.length === 0 ? (
            <EmptyState
              title="예약 가능한 원두·드립백이 없습니다."
              description="매장에서 상품을 등록하면 이곳에 표시됩니다."
            />
          ) : (
            <div className="space-y-3">
              {beans.map((bean) => {
                const beanGuide = brewGuides.find((g) => g.beanId === bean.id);
                return (
                  <div
                    key={bean.id}
                    className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4"
                  >
                    <button
                      type="button"
                      disabled={!showroom.businessVerified}
                      onClick={() => openBeanSheet(bean)}
                      className="w-full text-left transition active:scale-[0.99] disabled:opacity-60"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="rounded-[var(--radius-sm)] bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-medium text-[var(--fg-muted)]">
                              {bean.kind === "bean" ? "원두" : "드립백"}
                            </span>
                            <h3 className="truncate text-[15px] font-bold text-[var(--fg-strong)]">
                              {bean.name}
                            </h3>
                          </div>
                          {bean.notes ? (
                            <p className="mt-1.5 text-[13px] text-[var(--fg-muted)]">
                              {bean.notes}
                            </p>
                          ) : null}
                          <p className="mt-1.5 text-[12px] text-[var(--fg-muted)]">
                            {bean.unit}
                            {bean.kind === "bean" &&
                            bean.grindOptions.length > 0
                              ? ` · ${bean.grindOptions.map((g) => BEAN_GRIND_LABELS[g]).join("/")}`
                              : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-[15px] font-bold tabular-nums text-[var(--fg-strong)]">
                          {bean.price.toLocaleString("ko-KR")}원
                        </span>
                      </div>
                    </button>
                    {beanGuide ? (
                      <div className="mt-2.5 border-t border-[var(--border)] pt-2">
                        <Link
                          href={`/brew-guide/${beanGuide.id}`}
                          className="text-[12px] font-bold text-[var(--fg-muted)] underline"
                        >
                          브루 가이드 보기
                        </Link>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <>
          {/* 브루 가이드 */}
          {brewGuides.length > 0 ? (
            <section className="mt-6 px-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[16px] font-bold text-[var(--fg-strong)]">
                  브루 가이드
                </h3>
                <span className="text-[12px] text-[var(--fg-muted)]">
                  {brewGuides.length}건
                </span>
              </div>
              <div className="space-y-2">
                {brewGuides.map((guide) => (
                  <Link
                    key={guide.id}
                    href={`/brew-guide/${guide.id}`}
                    className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[13px]"
                  >
                    <span className="truncate font-bold text-[var(--fg-strong)]">
                      {guide.title}
                    </span>
                    <span className="shrink-0 text-[12px] font-bold text-[var(--fg-muted)] underline">
                      브루 가이드
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* 현장 제시형 디지털 쿠폰 & 타임세일 혜택 */}
          <section className="mt-6 px-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[16px] font-bold text-[var(--fg-strong)] flex items-center gap-1.5">
                <Ticket size={18} className="text-[var(--accent)]" />
                현장 제시형 혜택 쿠폰
              </h3>
              <span className="text-[12px] text-[var(--fg-muted)]">
                {coupons.length}건
              </span>
            </div>

            {coupons.length === 0 ? (
              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-[13px] text-[var(--fg-muted)]">
                현재 발행된 쿠폰이 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {coupons.map((coupon) => {
                  const isTimesale = coupon.couponType === "timesale";
                  const isHighlighted = coupon.id === highlightCouponId;
                  const atLimit =
                    (coupon.claimedCount ?? (coupon.claimed ? 1 : 0)) >=
                    (coupon.perUserLimit ?? 1);

                  return (
                    <div
                      key={coupon.id}
                      ref={(el) => {
                        couponRefs.current[coupon.id] = el;
                      }}
                      className={`relative rounded-[var(--radius-lg)] border bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] transition ${
                        isHighlighted
                          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/20"
                          : "border-[var(--border)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {isTimesale ? (
                              <span className="rounded-[var(--radius-pill)] bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-[var(--surface)]">
                                타임세일
                              </span>
                            ) : (
                              <span className="rounded-[var(--radius-pill)] bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-bold text-[var(--fg-muted)]">
                                일반
                              </span>
                            )}
                            <h4 className="truncate text-[15px] font-bold text-[var(--fg-strong)]">
                              {coupon.title}
                            </h4>
                          </div>
                          <p className="mt-1.5 text-[13px] font-medium text-[var(--fg)]">
                            {coupon.discountDetail}
                          </p>
                          <CouponTerms coupon={coupon} />
                          {coupon.policyVersion === 2 ? (
                            <p className="ds-body-s mt-2 text-[var(--fg-muted)]">
                              고객당 {coupon.perUserLimit}장 · 받은 쿠폰{" "}
                              {coupon.claimedCount ?? 0}장
                            </p>
                          ) : null}
                          <p className="mt-1 text-[11px] text-[var(--fg-muted)] flex items-center gap-1">
                            <Clock size={12} />
                            유효기간:{" "}
                            {new Date(coupon.validUntil).toLocaleDateString(
                              "ko-KR",
                              {
                                month: "numeric",
                                day: "numeric",
                                hour: "numeric",
                                minute: "numeric",
                              },
                            )}
                            까지
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={atLimit || claimingId === coupon.id}
                          onClick={() => handleClaim(coupon.id)}
                          className={`shrink-0 rounded-[var(--radius-md)] px-3 py-2 text-[12px] font-bold transition active:scale-95 ${
                            atLimit
                              ? "border border-[var(--border-strong)] bg-[var(--surface-alt)] text-[var(--fg-muted)] cursor-default"
                              : "bg-[var(--accent)] text-[var(--surface)] hover:bg-[var(--accent-hover)]"
                          }`}
                        >
                          {atLimit ? (
                            <span className="flex items-center gap-1">
                              <Check size={14} /> 담김
                            </span>
                          ) : claimingId === coupon.id ? (
                            "담는 중..."
                          ) : (
                            "쿠폰 담기"
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 대표 메뉴판 */}
          <section className="mt-8 px-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[16px] font-bold text-[var(--fg-strong)] flex items-center gap-1.5">
                <Coffee size={18} />
                대표 메뉴판
              </h3>
              <span className="text-[12px] text-[var(--fg-muted)]">
                {menus.length}개
              </span>
            </div>

            {menus.length === 0 ? (
              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-[13px] text-[var(--fg-muted)]">
                등록된 메뉴가 아직 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {menus.map((menu) => (
                  <div
                    key={menu.id}
                    className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-card)]"
                  >
                    {menu.imageUrl ? (
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-[var(--surface-alt)]">
                        <Image
                          src={menu.imageUrl}
                          alt={menu.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-[15px] font-bold text-[var(--fg-strong)]">
                        {menu.name}
                      </h4>
                      <p className="mt-0.5 text-[14px] font-bold text-[var(--accent)]">
                        {menu.price.toLocaleString("ko-KR")}원
                      </p>
                      {menu.tastingNotes && menu.tastingNotes.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {menu.tastingNotes.map((note, idx) => (
                            <span
                              key={idx}
                              className="rounded-[var(--radius-pill)] bg-[var(--surface-alt)] px-2 py-0.5 text-[10px] font-medium text-[var(--fg-muted)]"
                            >
                              {note}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 방문 인증 리뷰 */}
          <section className="mt-8 px-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-[16px] font-bold text-[var(--fg-strong)]">
                <MessageSquare size={18} />
                방문 인증 리뷰
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[var(--fg-muted)]">
                  {reviews.length}건
                </span>
                {canWriteReview ? (
                  <button
                    type="button"
                    onClick={() => setShowReviewForm((prev) => !prev)}
                    className="rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-1 text-[12px] font-bold text-[var(--fg)] transition active:scale-95"
                  >
                    리뷰 쓰기 +50P
                  </button>
                ) : null}
              </div>
            </div>

            {showReviewForm ? (
              <form
                onSubmit={handleSubmitReview}
                className="mb-4 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] p-4"
              >
                <textarea
                  value={reviewBody}
                  onChange={(e) => setReviewBody(e.target.value)}
                  minLength={REVIEW_MIN_LENGTH}
                  maxLength={REVIEW_MAX_LENGTH}
                  rows={3}
                  required
                  placeholder={`방문 후기를 남겨주세요 (${REVIEW_MIN_LENGTH}~${REVIEW_MAX_LENGTH}자)`}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--fg)] outline-none focus:border-[var(--accent)]"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-[var(--fg-muted)] tabular-nums">
                    {[...reviewBody].length}/{REVIEW_MAX_LENGTH}
                  </span>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="rounded-[var(--radius-md)] bg-[var(--fg)] px-3 py-1.5 text-[12px] font-bold text-[var(--surface)] disabled:opacity-50"
                  >
                    {submittingReview ? "등록 중..." : "등록하기"}
                  </button>
                </div>
              </form>
            ) : null}

            {reviews.length === 0 ? (
              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-[13px] text-[var(--fg-muted)]">
                아직 방문 인증 리뷰가 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <article
                    key={review.id}
                    className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-[var(--fg-strong)]">
                          {review.authorName}
                        </span>
                        <span className="rounded-[var(--radius-sm)] bg-[var(--surface-alt)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--fg-muted)]">
                          방문 인증
                        </span>
                      </div>
                      <button
                        type="button"
                        aria-label="리뷰 신고"
                        onClick={() => setReportingReview(review)}
                        className="flex items-center gap-1 text-[11px] text-[var(--fg-subtle)]"
                      >
                        <Flag size={12} aria-hidden="true" />
                        신고
                      </button>
                    </div>
                    <p
                      dir="auto"
                      className="mt-2 text-[13px] leading-[1.5] text-[var(--fg)]"
                    >
                      {review.body}
                    </p>
                    <p className="mt-1.5 text-[11px] text-[var(--fg-muted)] tabular-nums">
                      {new Date(review.createdAt).toLocaleDateString("ko-KR")}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {selectedBean ? (
        <div className="fixed inset-0 z-50 bg-black/35">
          <BottomSheet zIndexClass="z-50" scrollable>
            <div className="flex shrink-0 items-center justify-between gap-2 pb-2">
              <h3 className="truncate text-[16px] font-bold text-[var(--fg-strong)]">
                {selectedBean.name} ({selectedBean.unit})
              </h3>
              <button
                type="button"
                aria-label="예약 시트 닫기"
                onClick={() => setSelectedBean(null)}
                className="flex h-9 w-9 items-center justify-center text-[var(--fg-subtle)]"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleSubmitReservation}
              className="min-h-0 space-y-4 overflow-y-auto pt-2 pb-2"
            >
              {selectedBean.kind === "bean" &&
              selectedBean.grindOptions.length > 0 ? (
                <div>
                  <p className="ds-label text-[var(--fg-muted)]">분쇄도</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {selectedBean.grindOptions.map((opt) => (
                      <Chip
                        key={opt}
                        selected={reserveGrind === opt}
                        onClick={() => setReserveGrind(opt)}
                      >
                        {BEAN_GRIND_LABELS[opt]}
                      </Chip>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ds-label block text-[var(--fg-muted)]">
                    수량 (1~10)
                  </label>
                  <input
                    type="number"
                    min={RESERVATION_MIN_QUANTITY}
                    max={RESERVATION_MAX_QUANTITY}
                    value={reserveQuantity}
                    onChange={(e) =>
                      setReserveQuantity(
                        Math.max(
                          RESERVATION_MIN_QUANTITY,
                          Math.min(
                            RESERVATION_MAX_QUANTITY,
                            parseInt(e.target.value, 10) || 1,
                          ),
                        ),
                      )
                    }
                    className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--fg)]"
                  />
                </div>
                <div>
                  <label className="ds-label block text-[var(--fg-muted)]">
                    픽업 날짜
                  </label>
                  <input
                    type="date"
                    min={toKstDateKey()}
                    max={addKstDays(toKstDateKey(), RESERVATION_MAX_DAYS_AHEAD)}
                    value={reservePickupDate}
                    onChange={(e) => setReservePickupDate(e.target.value)}
                    required
                    className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--fg)]"
                  />
                </div>
              </div>

              <div>
                <label className="ds-label block text-[var(--fg-muted)]">
                  메모 (선택, 최대 {RESERVATION_NOTE_MAX_LENGTH}자)
                </label>
                <input
                  type="text"
                  maxLength={RESERVATION_NOTE_MAX_LENGTH}
                  value={reserveNote}
                  onChange={(e) => setReserveNote(e.target.value)}
                  placeholder="예: 오후 3시경 방문 예정입니다"
                  className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--fg)]"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={submittingReservation}
                pending={submittingReservation}
              >
                예약 신청 (
                {(selectedBean.price * reserveQuantity).toLocaleString("ko-KR")}
                원 · 현장 결제)
              </Button>
            </form>
          </BottomSheet>
        </div>
      ) : null}

      {reportingReview ? (
        <ReportDialog
          targetType="content"
          targetId={reportingReview.id}
          parentId={showroom.id}
          authorId={reportingReview.userId}
          onClose={() => setReportingReview(null)}
        />
      ) : null}

      <BottomNav active="map" />
    </main>
  );
}
