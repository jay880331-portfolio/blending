"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Coffee, Megaphone, Plus, Store, Trash2 } from "lucide-react";
import type { WorkplaceLocation } from "@/domain/member/types";
import type {
  BaristaShowroom,
  NoticeManageStore,
  ShowroomMenu,
} from "@/domain/showroom/types";
import {
  DEFAULT_EXCHANGE_POINTS,
  EXCHANGE_POINTS_STEP,
  MAX_EXCHANGE_POINTS,
  MIN_EXCHANGE_POINTS,
} from "@/domain/passport/ledger";
import {
  PASSPORT_FLAVORS,
  PASSPORT_MENUS,
  type PassportFlavor,
  type PassportMenu,
} from "@/domain/passport/passport";
import {
  STATUS_NOTICE_MAX_LENGTH,
  type ShowroomNoticeExpiryOption,
} from "@/domain/showroom/statusNotice";
import {
  matchingWorkplaceId,
  showroomLocationFromWorkplace,
  workplaceFullAddress,
} from "@/domain/showroom/fromWorkplace";
import {
  addMenu,
  approveCouponUseRequest,
  deleteShowroomNotice,
  fetchCouponUseRequests,
  fetchMyShowroom,
  rejectCouponUseRequest,
  removeMenu,
  saveShowroom,
  saveShowroomNotice,
  ShowroomApiError,
  updateMenuExchangePoints,
} from "@/adapters/http/showroomApi";
import { Chip } from "@/ui/shared/Chip";
import { ShowroomHeader } from "@/ui/showroom/ShowroomHeader";
import { BeanManagerPanel } from "./BeanManagerPanel";
import { BusinessVerificationPanel } from "./BusinessVerificationPanel";
import { CouponApprovalInbox } from "./CouponApprovalInbox";
import { CouponManager } from "./CouponManager";
import { CouponStaffPanel } from "./CouponStaffPanel";
import { ReservationInboxPanel } from "./ReservationInboxPanel";
import { BottomNav } from "@/ui/shared/BottomNav";

export function ShowroomManageApp({
  workplaces,
}: {
  workplaces: WorkplaceLocation[];
}) {
  const [showroom, setShowroom] = useState<BaristaShowroom | null>(null);
  const [menus, setMenus] = useState<ShowroomMenu[]>([]);
  const [noticeStores, setNoticeStores] = useState<NoticeManageStore[]>([]);
  const [selectedNoticeStoreId, setSelectedNoticeStoreId] =
    useState<string>("");
  const [noticeText, setNoticeText] = useState("");
  const [noticeExpiry, setNoticeExpiry] =
    useState<ShowroomNoticeExpiryOption>("today_end");
  const [savingNotice, setSavingNotice] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingShowroom, setSavingShowroom] = useState(false);

  const [selectedWorkplaceId, setSelectedWorkplaceId] = useState<string | null>(
    workplaces[0]?.id ?? null,
  );
  const [bioMessage, setBioMessage] = useState("");
  const [tasteFlavors, setTasteFlavors] = useState<PassportFlavor[]>([]);
  const [tasteMenus, setTasteMenus] = useState<PassportMenu[]>([]);
  const [tasteHasDecaf, setTasteHasDecaf] = useState(false);
  const selectedWorkplace = useMemo(
    () =>
      workplaces.find((workplace) => workplace.id === selectedWorkplaceId) ??
      null,
    [selectedWorkplaceId, workplaces],
  );

  // 메뉴 폼 모달 상태
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [menuName, setMenuName] = useState("");
  const [menuPrice, setMenuPrice] = useState("");
  const [menuTastingNotes, setMenuTastingNotes] = useState("");
  const [menuImageUrl, setMenuImageUrl] = useState("");
  const [menuExchangeEnabled, setMenuExchangeEnabled] = useState(false);
  const [menuExchangePoints, setMenuExchangePoints] = useState(
    String(DEFAULT_EXCHANGE_POINTS),
  );
  const [addingMenu, setAddingMenu] = useState(false);

  // 쿠폰 사용 승인 요청 상태
  const [couponRequests, setCouponRequests] = useState<
    Array<{ userCouponId: string; couponTitle: string; memberName: string }>
  >([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(
    null,
  );
  const [requestStatusMessage, setRequestStatusMessage] = useState<
    string | null
  >(null);

  const reloadCouponRequests = async () => {
    try {
      const data = await fetchCouponUseRequests();
      setCouponRequests(data);
    } catch {
      // 실패하면 현재 목록을 유지한다.
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchCouponUseRequests()
      .then((data) => {
        if (!cancelled) setCouponRequests(data);
      })
      .catch(() => {});

    const intervalId = window.setInterval(() => {
      fetchCouponUseRequests()
        .then((data) => {
          if (!cancelled) setCouponRequests(data);
        })
        .catch(() => {});
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMyShowroom()
      .then((data) => {
        if (!cancelled) {
          if (data.showroom) {
            setShowroom(data.showroom);
            setSelectedWorkplaceId(
              matchingWorkplaceId(workplaces, data.showroom),
            );
            setBioMessage(data.showroom.bioMessage);
            setTasteFlavors(data.showroom.tasteProfile?.flavors ?? []);
            setTasteMenus(data.showroom.tasteProfile?.signatureMenus ?? []);
            setTasteHasDecaf(Boolean(data.showroom.tasteProfile?.hasDecaf));
          }
          setMenus(data.menus);
          const stores = data.noticeStores ?? [];
          setNoticeStores(stores);
          if (stores[0]) {
            setSelectedNoticeStoreId(stores[0].id);
            setNoticeText(stores[0].statusNotice?.text ?? "");
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workplaces]);

  const handleSaveShowroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkplace) {
      alert("프로필에 등록한 소속 매장을 선택해주세요.");
      return;
    }
    if (!bioMessage.trim()) {
      alert("한줄 소식을 입력해주세요.");
      return;
    }
    try {
      setSavingShowroom(true);
      const updated = await saveShowroom({
        storeName: selectedWorkplace.name,
        bioMessage,
        location: showroomLocationFromWorkplace(selectedWorkplace),
        tasteProfile: {
          flavors: tasteFlavors,
          signatureMenus: tasteMenus,
          hasDecaf: tasteHasDecaf,
        },
      });
      setShowroom(updated);
      setNoticeStores((prev) => {
        const exists = prev.some((s) => s.id === updated.id);
        if (exists) {
          return prev.map((s) =>
            s.id === updated.id ? { ...s, storeName: updated.storeName } : s,
          );
        }
        return [
          {
            id: updated.id,
            storeName: updated.storeName,
            isOwner: true,
            statusNotice: updated.statusNotice,
          },
          ...prev,
        ];
      });
      setSelectedNoticeStoreId((prev) => prev || updated.id);
      alert("쇼룸 정보가 저장되었습니다.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSavingShowroom(false);
    }
  };

  const handleAddMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuName.trim() || !menuPrice) {
      alert("메뉴 이름과 가격을 입력해주세요.");
      return;
    }
    try {
      setAddingMenu(true);
      const exchangePoints = menuExchangeEnabled
        ? parseInt(menuExchangePoints, 10) || DEFAULT_EXCHANGE_POINTS
        : null;
      const newMenu = await addMenu({
        name: menuName,
        price: parseInt(menuPrice, 10) || 0,
        tastingNotes: menuTastingNotes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        imageUrl: menuImageUrl.trim(),
        exchangePoints,
      });
      setMenus((prev) => [...prev, newMenu]);
      setShowMenuForm(false);
      setMenuName("");
      setMenuPrice("");
      setMenuTastingNotes("");
      setMenuImageUrl("");
      setMenuExchangeEnabled(false);
      setMenuExchangePoints(String(DEFAULT_EXCHANGE_POINTS));
    } catch (err) {
      alert(err instanceof Error ? err.message : "메뉴 추가에 실패했습니다.");
    } finally {
      setAddingMenu(false);
    }
  };

  const handleDeleteMenu = async (menuId: string) => {
    if (!confirm("이 메뉴를 삭제하시겠습니까?")) return;
    try {
      await removeMenu(menuId);
      setMenus((prev) => prev.filter((m) => m.id !== menuId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    }
  };

  const handleApproveRequest = async (userCouponId: string) => {
    if (processingRequestId) return;
    setProcessingRequestId(userCouponId);
    try {
      await approveCouponUseRequest(userCouponId);
      setRequestStatusMessage(null);
      await reloadCouponRequests();
    } catch (err) {
      if (err instanceof ShowroomApiError && err.status === 409) {
        setRequestStatusMessage("이미 처리되었거나 승인 시간이 지났습니다.");
        await reloadCouponRequests();
      } else {
        setRequestStatusMessage("처리에 실패했습니다. 다시 시도해주세요.");
      }
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRejectRequest = async (userCouponId: string) => {
    if (processingRequestId) return;
    setProcessingRequestId(userCouponId);
    try {
      await rejectCouponUseRequest(userCouponId);
      setRequestStatusMessage(null);
      await reloadCouponRequests();
    } catch (err) {
      if (err instanceof ShowroomApiError && err.status === 409) {
        setRequestStatusMessage("이미 처리되었거나 승인 시간이 지났습니다.");
        await reloadCouponRequests();
      } else {
        setRequestStatusMessage("처리에 실패했습니다. 다시 시도해주세요.");
      }
    } finally {
      setProcessingRequestId(null);
    }
  };

  const selectedNoticeStore = useMemo(
    () =>
      noticeStores.find((s) => s.id === selectedNoticeStoreId) ??
      noticeStores[0] ??
      null,
    [noticeStores, selectedNoticeStoreId],
  );

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNoticeStore || savingNotice) return;
    if (!noticeText.trim()) {
      alert("한줄공지 내용을 입력해주세요.");
      return;
    }
    try {
      setSavingNotice(true);
      const updated = await saveShowroomNotice(
        selectedNoticeStore.id,
        noticeText,
        noticeExpiry,
      );
      setNoticeStores((prev) =>
        prev.map((s) =>
          s.id === selectedNoticeStore.id ? { ...s, statusNotice: updated } : s,
        ),
      );
      setNoticeText(updated.text);
      alert("한줄공지가 등록되었습니다.");
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "한줄공지 등록에 실패했습니다.",
      );
    } finally {
      setSavingNotice(false);
    }
  };

  const handleDeleteNotice = async () => {
    if (!selectedNoticeStore || savingNotice) return;
    try {
      setSavingNotice(true);
      await deleteShowroomNotice(selectedNoticeStore.id);
      setNoticeStores((prev) =>
        prev.map((s) =>
          s.id === selectedNoticeStore.id
            ? { ...s, statusNotice: undefined }
            : s,
        ),
      );
      setNoticeText("");
      alert("한줄공지가 삭제되었습니다.");
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "한줄공지 삭제에 실패했습니다.",
      );
    } finally {
      setSavingNotice(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--surface-alt)] pb-28 text-[var(--fg)]">
        <ShowroomHeader title="쇼룸 관리" backHref="/mypage" />
        <div className="py-20 text-center text-[14px] text-[var(--fg-muted)]">
          쇼룸 정보를 불러오고 있습니다...
        </div>
        <BottomNav active="mypage" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--surface-alt)] pb-28 text-[var(--fg)]">
      <ShowroomHeader title="쇼룸 관리" backHref="/mypage" />

      <CouponApprovalInbox />

      {/* 1. 쇼룸 기본 정보 설정 */}
      <section className="px-5 pt-4">
        <form
          onSubmit={handleSaveShowroom}
          className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]"
        >
          <h2 className="text-[16px] font-bold text-[var(--fg-strong)] flex items-center gap-1.5">
            <Store size={18} />
            바리스타 쇼룸 기본 정보
          </h2>

          <div className="mt-4 space-y-3">
            <div>
              <p className="block text-[12px] font-bold text-[var(--fg-muted)]">
                소속 매장 *
              </p>
              {workplaces.length === 0 ? (
                <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-3">
                  <p className="text-[13px] text-[var(--fg)]">
                    프로필에 등록한 소속 주소가 없습니다.
                  </p>
                  <Link
                    href="/home/profile/edit"
                    className="mt-2 inline-block text-[12px] font-bold text-[var(--accent)]"
                  >
                    프로필에서 소속 등록
                  </Link>
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  {workplaces.map((workplace) => {
                    const address = workplaceFullAddress(workplace);
                    return (
                      <label
                        key={workplace.id}
                        className="flex cursor-pointer items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2.5"
                      >
                        <input
                          type="radio"
                          name="showroom-workplace"
                          checked={selectedWorkplaceId === workplace.id}
                          onChange={() => setSelectedWorkplaceId(workplace.id)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="block text-[14px] font-bold text-[var(--fg-strong)]">
                            {workplace.name}
                          </span>
                          {address ? (
                            <span className="mt-0.5 block text-[12px] text-[var(--fg-muted)]">
                              {address}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[12px] font-bold text-[var(--fg-muted)]">
                한줄 소식 (소개) *
              </label>
              <textarea
                value={bioMessage}
                onChange={(e) => setBioMessage(e.target.value)}
                placeholder="예: 봄 시즌 특별 싱글 오리진이 준비되어 있습니다."
                rows={2}
                required
                className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--fg)] outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <p className="block text-[12px] font-bold text-[var(--fg-muted)]">
                매장 취향 태그
              </p>
              <div className="mt-2 space-y-2.5">
                <div>
                  <span className="text-[11px] font-medium text-[var(--fg-muted)]">
                    대표 풍미
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {PASSPORT_FLAVORS.map((item) => (
                      <Chip
                        key={item.value}
                        selected={tasteFlavors.includes(item.value)}
                        onClick={() =>
                          setTasteFlavors((prev) =>
                            prev.includes(item.value)
                              ? prev.filter((v) => v !== item.value)
                              : [...prev, item.value],
                          )
                        }
                      >
                        {item.label}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-[var(--fg-muted)]">
                    시그니처 메뉴
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {PASSPORT_MENUS.map((item) => (
                      <Chip
                        key={item.value}
                        selected={tasteMenus.includes(item.value)}
                        onClick={() =>
                          setTasteMenus((prev) =>
                            prev.includes(item.value)
                              ? prev.filter((v) => v !== item.value)
                              : [...prev, item.value],
                          )
                        }
                      >
                        {item.label}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <Chip
                    selected={tasteHasDecaf}
                    onClick={() => setTasteHasDecaf((prev) => !prev)}
                  >
                    디카페인 가능
                  </Chip>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={savingShowroom || workplaces.length === 0}
              className="rounded-[var(--radius-md)] bg-[var(--fg)] px-4 py-2 text-[13px] font-bold text-[var(--surface)] transition active:scale-95 disabled:opacity-50"
            >
              {savingShowroom ? "저장 중..." : "쇼룸 정보 저장"}
            </button>
          </div>
        </form>
      </section>

      {selectedNoticeStore ? (
        <section className="mt-6 px-5">
          <form
            onSubmit={handleSaveNotice}
            className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[16px] font-bold text-[var(--fg-strong)]">
                <Megaphone size={18} />
                오늘 한줄공지
              </h2>
              <span className="text-[12px] text-[var(--fg-muted)] tabular-nums">
                {[...noticeText].length}/{STATUS_NOTICE_MAX_LENGTH}
              </span>
            </div>

            {noticeStores.length > 1 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {noticeStores.map((store) => (
                  <Chip
                    key={store.id}
                    selected={store.id === selectedNoticeStore.id}
                    onClick={() => {
                      setSelectedNoticeStoreId(store.id);
                      setNoticeText(store.statusNotice?.text ?? "");
                    }}
                  >
                    {store.storeName}
                  </Chip>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
                {selectedNoticeStore.storeName}
              </p>
            )}

            <div className="mt-3">
              <input
                type="text"
                value={noticeText}
                onChange={(e) => setNoticeText(e.target.value)}
                maxLength={STATUS_NOTICE_MAX_LENGTH}
                placeholder="예: 오늘 게이샤 드립 가능합니다 (최대 40자)"
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--fg)] outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(
                [
                  { value: "today_end", label: "오늘 마감" },
                  { value: "3h", label: "3시간" },
                  { value: "6h", label: "6시간" },
                ] as const
              ).map((option) => (
                <Chip
                  key={option.value}
                  selected={noticeExpiry === option.value}
                  onClick={() => setNoticeExpiry(option.value)}
                >
                  {option.label}
                </Chip>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              {selectedNoticeStore.statusNotice ? (
                <button
                  type="button"
                  disabled={savingNotice}
                  onClick={() => void handleDeleteNotice()}
                  className="rounded-[var(--radius-md)] border border-[var(--border-strong)] px-3 py-2 text-[13px] font-bold text-[var(--danger)] transition active:scale-95 disabled:opacity-50"
                >
                  삭제
                </button>
              ) : null}
              <button
                type="submit"
                disabled={savingNotice}
                className="rounded-[var(--radius-md)] bg-[var(--fg)] px-4 py-2 text-[13px] font-bold text-[var(--surface)] transition active:scale-95 disabled:opacity-50"
              >
                {savingNotice ? "저장 중..." : "공지 등록"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {showroom ? (
        <BusinessVerificationPanel
          key={`biz-${showroom.id}`}
          showroom={showroom}
          onUpdated={(next) => setShowroom(next)}
        />
      ) : null}

      {showroom ? <CouponStaffPanel key={`staff-${showroom.id}`} /> : null}

      {showroom ? (
        <CouponManager key={`coupons-${showroom.id}`} showroom={showroom} />
      ) : null}
      <section className="mt-6 px-5">
        {/* 기존 쿠폰의 사용 승인 요청 */}
        {requestStatusMessage || couponRequests.length > 0 ? (
          <div className="mb-4">
            <h4 className="text-[14px] font-bold text-[var(--fg-strong)] mb-2">
              사용 승인 요청
            </h4>
            {requestStatusMessage ? (
              <p className="mb-2 text-[12px] text-[var(--fg-muted)]">
                {requestStatusMessage}
              </p>
            ) : null}
            {couponRequests.length === 0 ? (
              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 text-center text-[13px] text-[var(--fg-muted)]">
                승인할 요청이 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {couponRequests.map((req) => {
                  const isItemProcessing =
                    processingRequestId === req.userCouponId;
                  const isAnyProcessing = processingRequestId !== null;

                  return (
                    <div
                      key={req.userCouponId}
                      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h5 className="text-[15px] font-bold text-[var(--fg-strong)] truncate">
                            {req.couponTitle}
                          </h5>
                          {req.memberName ? (
                            <p className="mt-0.5 text-[13px] text-[var(--fg-muted)]">
                              {req.memberName}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isItemProcessing ? (
                            <span className="text-[12px] font-bold text-[var(--fg-muted)] px-3 py-1.5">
                              처리 중...
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={isAnyProcessing}
                                onClick={() =>
                                  handleApproveRequest(req.userCouponId)
                                }
                                className="rounded-[var(--radius-md)] bg-[var(--fg)] px-3 py-1.5 text-[12px] font-bold text-[var(--surface)] hover:opacity-90 transition active:scale-95 disabled:opacity-40"
                              >
                                승인
                              </button>
                              <button
                                type="button"
                                disabled={isAnyProcessing}
                                onClick={() =>
                                  handleRejectRequest(req.userCouponId)
                                }
                                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[var(--danger)] hover:bg-[var(--surface-alt)] transition active:scale-95 disabled:opacity-40"
                              >
                                거절
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </section>

      {/* 3. 대표 메뉴판 관리 */}
      <section className="mt-8 px-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[16px] font-bold text-[var(--fg-strong)] flex items-center gap-1.5">
              <Coffee size={18} />
              대표 메뉴판 관리
            </h3>
            <p className="text-[12px] text-[var(--fg-muted)]">
              {showroom
                ? "쇼룸에 노출될 대표 음료와 테이스팅 노트"
                : "소속 매장을 선택하고 쇼룸을 저장하면 메뉴를 추가할 수 있습니다."}
            </p>
          </div>
          <button
            type="button"
            disabled={!showroom}
            title={
              showroom
                ? undefined
                : "소속 매장을 선택하고 쇼룸을 저장하면 메뉴를 추가할 수 있습니다."
            }
            onClick={() => setShowMenuForm(true)}
            className="flex items-center gap-1 rounded-[var(--radius-md)] bg-[var(--fg)] px-3 py-1.5 text-[12px] font-bold text-[var(--surface)] transition active:scale-95 disabled:opacity-40"
          >
            <Plus size={15} /> 메뉴 추가
          </button>
        </div>

        {/* 메뉴 추가 폼 */}
        {showMenuForm ? (
          <form
            onSubmit={handleAddMenu}
            className="mb-4 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] p-4 shadow-[var(--shadow-modal)]"
          >
            <h4 className="text-[14px] font-bold text-[var(--fg-strong)] mb-3">
              새 대표 메뉴 추가
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-bold text-[var(--fg-muted)]">
                  메뉴명 *
                </label>
                <input
                  type="text"
                  value={menuName}
                  onChange={(e) => setMenuName(e.target.value)}
                  placeholder="예: 에티오피아 게이샤 드립"
                  required
                  className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-[13px] text-[var(--fg)] outline-none"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[var(--fg-muted)]">
                  가격 (원) *
                </label>
                <input
                  type="number"
                  value={menuPrice}
                  onChange={(e) => setMenuPrice(e.target.value)}
                  placeholder="예: 7000"
                  required
                  className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-[13px] text-[var(--fg)] outline-none"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[var(--fg-muted)]">
                  테이스팅 노트 (쉼표로 구분)
                </label>
                <input
                  type="text"
                  value={menuTastingNotes}
                  onChange={(e) => setMenuTastingNotes(e.target.value)}
                  placeholder="예: 자스민, 베르가못, 복숭아, 꿀"
                  className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-[13px] text-[var(--fg)] outline-none"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[var(--fg-muted)]">
                  대표 이미지 URL (선택)
                </label>
                <input
                  type="url"
                  value={menuImageUrl}
                  onChange={(e) => setMenuImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-[13px] text-[var(--fg)] outline-none"
                />
              </div>

              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] p-3">
                <label className="flex cursor-pointer items-center gap-2 text-[12px] font-bold text-[var(--fg-strong)]">
                  <input
                    type="checkbox"
                    checked={menuExchangeEnabled}
                    onChange={(e) => setMenuExchangeEnabled(e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  여권 포인트 교환 메뉴로 설정
                </label>
                {menuExchangeEnabled ? (
                  <div className="mt-2">
                    <label className="block text-[11px] font-medium text-[var(--fg-muted)]">
                      차감 포인트 ({MIN_EXCHANGE_POINTS}~
                      {MAX_EXCHANGE_POINTS.toLocaleString("ko-KR")}P,{" "}
                      {EXCHANGE_POINTS_STEP}P 단위)
                    </label>
                    <input
                      type="number"
                      min={MIN_EXCHANGE_POINTS}
                      max={MAX_EXCHANGE_POINTS}
                      step={EXCHANGE_POINTS_STEP}
                      value={menuExchangePoints}
                      onChange={(e) => setMenuExchangePoints(e.target.value)}
                      className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-[13px] text-[var(--fg)] outline-none"
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowMenuForm(false)}
                className="rounded-[var(--radius-md)] px-3 py-1.5 text-[12px] text-[var(--fg-muted)]"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={addingMenu}
                className="rounded-[var(--radius-md)] bg-[var(--fg)] px-3 py-1.5 text-[12px] font-bold text-[var(--surface)]"
              >
                {addingMenu ? "등록 중..." : "메뉴 등록"}
              </button>
            </div>
          </form>
        ) : null}

        {/* 등록된 메뉴 목록 */}
        {menus.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-[13px] text-[var(--fg-muted)]">
            등록된 대표 메뉴가 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {menus.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-card)]"
              >
                <div>
                  <h4 className="text-[15px] font-bold text-[var(--fg-strong)]">
                    {m.name}
                  </h4>
                  <p className="mt-0.5 text-[13px] font-bold text-[var(--accent)]">
                    {m.price.toLocaleString("ko-KR")}원
                  </p>
                  {m.tastingNotes && m.tastingNotes.length > 0 ? (
                    <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                      {m.tastingNotes.join(" · ")}
                    </p>
                  ) : null}
                  <div className="mt-2 flex items-center gap-2">
                    <Chip
                      selected={m.exchangePoints != null}
                      onClick={async () => {
                        const next =
                          m.exchangePoints != null
                            ? null
                            : DEFAULT_EXCHANGE_POINTS;
                        try {
                          const updated = await updateMenuExchangePoints(
                            m.id,
                            next,
                          );
                          setMenus((prev) =>
                            prev.map((item) =>
                              item.id === m.id ? updated : item,
                            ),
                          );
                        } catch (err) {
                          alert(
                            err instanceof Error
                              ? err.message
                              : "설정에 실패했습니다.",
                          );
                        }
                      }}
                    >
                      {m.exchangePoints != null
                        ? `교환 ${m.exchangePoints.toLocaleString("ko-KR")}P`
                        : "교환 설정"}
                    </Chip>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteMenu(m.id)}
                  className="p-2 text-[var(--fg-subtle)] hover:text-[var(--danger)]"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      {showroom ? <BeanManagerPanel storeId={showroom.id} /> : null}

      {selectedNoticeStore ? (
        <ReservationInboxPanel
          key={`resv-${selectedNoticeStore.id}`}
          storeId={selectedNoticeStore.id}
        />
      ) : null}

      <BottomNav active="mypage" />
    </main>
  );
}
