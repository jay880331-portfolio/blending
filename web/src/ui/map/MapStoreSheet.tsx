import NextLink from "next/link";
import {
  CheckCircle2,
  Clock,
  Megaphone,
  Store,
  UserRound,
  X,
} from "lucide-react";
import { matchStoreTags } from "@/domain/passport/match";
import type {
  CoffeePassport,
  StoreTasteProfile,
} from "@/domain/passport/passport";
import type { ShowroomStatusNotice } from "@/domain/showroom/statusNotice";
import { Avatar } from "@/ui/shared/Avatar";
import { BottomSheet } from "@/ui/shared/BottomSheet";
import { FavoriteStarIcon } from "@/ui/shared/FavoriteStarIcon";

export type MapStoreSheetTimesale = {
  id: string;
  title: string;
  discountDetail: string;
  validUntil: string;
};

export type MapStoreSheetStore = {
  id: string;
  storeName: string;
  address?: string;
  statusNotice?: ShowroomStatusNotice;
  tasteProfile?: StoreTasteProfile;
  favorited: boolean;
  stampCount?: number;
  canRedeem?: boolean;
  hasActiveBeans?: boolean;
  businessVerified?: boolean;
  activeTimesaleCoupons: MapStoreSheetTimesale[];
};

export type MapStoreSheetProfile = {
  id: string;
  profileId?: string;
  name: string;
  workplace: string;
  avatarUrl?: string;
  online: boolean;
  skills: string[];
};

export function MapStoreSheet<T extends MapStoreSheetProfile>({
  store,
  profiles,
  viewerPassport,
  savingFavorite,
  onClose,
  onFavoriteToggle,
  onProfileSelect,
}: {
  store: MapStoreSheetStore;
  profiles: T[];
  viewerPassport?: CoffeePassport | null;
  savingFavorite: boolean;
  onClose: () => void;
  onFavoriteToggle: () => void;
  onProfileSelect: (profile: T) => void;
}) {
  const tasteMatch = matchStoreTags(viewerPassport, store.tasteProfile);
  const visibleProfiles = profiles.filter((profile, index, allProfiles) => {
    if (!profile.profileId) return true;
    return (
      allProfiles.findIndex((item) => item.profileId === profile.profileId) ===
      index
    );
  });

  return (
    <BottomSheet zIndexClass="z-50" scrollable>
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-[16px] font-bold leading-[1.35] text-[var(--fg-strong)]">
              {store.storeName}
            </h2>
            {store.businessVerified ? (
              <span className="shrink-0 rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--surface-alt)] px-2 py-0.5 text-[10px] font-bold text-[var(--fg-strong)]">
                인증 매장
              </span>
            ) : null}
          </div>
          {store.address ? (
            <p className="mt-0.5 truncate text-[12px] leading-[1.4] text-[var(--fg-muted)]">
              {store.address}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {store.hasActiveBeans ? (
            <NextLink
              prefetch={false}
              href={`/showroom/${store.id}?tab=beans`}
              aria-label={`${store.storeName} 원두 예약`}
              className="flex h-10 items-center rounded-[var(--radius-lg)] border border-[var(--border-strong)] px-2.5 text-[12px] font-bold text-[var(--fg)] transition active:scale-95"
            >
              원두 예약
            </NextLink>
          ) : null}
          <NextLink
            prefetch={false}
            href={`/showroom/${store.id}`}
            aria-label={`${store.storeName} 쇼룸 보기`}
            className="flex h-10 items-center gap-1.5 rounded-[var(--radius-lg)] border border-[var(--border-strong)] px-3 text-[13px] font-bold text-[var(--fg)] transition active:scale-95"
          >
            <Store size={16} strokeWidth={2.2} aria-hidden="true" />
            쇼룸
          </NextLink>
          <button
            type="button"
            aria-label={store.favorited ? "매장 찜 해제" : "매장 찜하기"}
            aria-pressed={store.favorited}
            disabled={savingFavorite}
            onClick={onFavoriteToggle}
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-strong)] text-[var(--accent)] transition active:scale-95 disabled:opacity-60"
          >
            <FavoriteStarIcon filled={store.favorited} size={20} />
          </button>
          <button
            type="button"
            aria-label="매장 정보 닫기"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center text-[var(--fg-subtle)]"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      {store.statusNotice ? (
        <div className="mt-2.5 flex shrink-0 items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2">
          <Megaphone
            size={15}
            className="mt-0.5 shrink-0 text-[var(--fg-muted)]"
            aria-hidden="true"
          />
          <p className="text-[13px] font-medium leading-[1.4] text-[var(--fg)]">
            {store.statusNotice.text}
          </p>
        </div>
      ) : null}

      {tasteMatch.matched ||
      tasteMatch.tags.length > 0 ||
      (store.stampCount ?? 0) > 0 ? (
        <div className="mt-2 flex shrink-0 flex-wrap items-center gap-1.5">
          {(store.stampCount ?? 0) > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--surface-alt)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--fg-strong)] tabular-nums">
              내 스탬프 {store.stampCount}회
              {store.canRedeem ? " · 교환 가능" : ""}
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

      {store.activeTimesaleCoupons.length > 0 ? (
        <div className="mt-2 shrink-0 space-y-1.5">
          {store.activeTimesaleCoupons.map((coupon) => (
            <NextLink
              key={coupon.id}
              prefetch={false}
              href={`/showroom/${store.id}?coupon=${encodeURIComponent(coupon.id)}`}
              className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--surface)] px-3 py-2 text-[13px] transition active:scale-[0.99]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 rounded-[var(--radius-pill)] bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-[var(--surface)]">
                  타임세일
                </span>
                <span className="truncate font-bold text-[var(--fg-strong)]">
                  {coupon.title}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-[var(--accent)]">
                <Clock size={12} aria-hidden="true" />
                받기
              </span>
            </NextLink>
          ))}
        </div>
      ) : null}

      <div className="mt-3 min-h-0 overflow-y-auto border-t border-[var(--border)] divide-y divide-[var(--border)]">
        {visibleProfiles.map((profile) => (
          <div
            key={profile.id}
            className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 py-3"
          >
            <Avatar
              src={profile.avatarUrl}
              alt=""
              size="sm"
              icon={<UserRound size={20} strokeWidth={1.8} />}
              className="!h-10 !w-10"
            >
              {profile.online ? (
                <span className="absolute right-0 top-0 z-10 h-3 w-3 rounded-[var(--radius-pill)] border-2 border-[var(--surface)] bg-[var(--success)]" />
              ) : null}
            </Avatar>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold leading-[1.4] text-[var(--fg-strong)]">
                {profile.name}
              </span>
              <span className="mt-0.5 block truncate text-[13px] leading-[1.5] text-[var(--fg-muted)]">
                {profile.skills[0] ?? "전문 분야 미입력"}
              </span>
            </span>
            <button
              type="button"
              aria-label={`${profile.name} 공개 프로필 보기`}
              onClick={() => onProfileSelect(profile)}
              className="text-[13px] font-bold leading-[1.4] text-[var(--accent)] transition active:scale-95"
            >
              보기
            </button>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}
