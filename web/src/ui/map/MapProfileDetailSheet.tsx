import NextLink from "next/link";
import { MessageCircle, Store, UserRound } from "lucide-react";
import { Avatar } from "@/ui/shared/Avatar";
import { BottomSheet } from "@/ui/shared/BottomSheet";
import { FavoriteStarIcon } from "@/ui/shared/FavoriteStarIcon";

export type MapProfileDetailSheetProfile = {
  profileId: string;
  name: string;
  workplace: string;
  address: string;
  avatarUrl?: string;
  online: boolean;
  canMessage: boolean;
  isOwnProfile: boolean;
};

export function MapProfileDetailSheet<T extends MapProfileDetailSheetProfile>({
  favorite,
  savingFavorite,
  profile,
  onFavoriteToggle,
}: {
  favorite: boolean;
  savingFavorite: boolean;
  profile: T;
  onFavoriteToggle: () => void;
}) {
  return (
    <BottomSheet>
      <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3">
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
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold leading-[1.4] text-[var(--fg-strong)]">
            {profile.name}
          </p>
          <p className="mt-0.5 truncate text-[13px] leading-[1.5] text-[var(--fg-muted)]">
            {profile.workplace}
          </p>
          <p className="mt-0.5 truncate text-[12px] leading-[1.5] text-[var(--fg-muted)]">
            {profile.address}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2">
          {profile.canMessage ? (
            <NextLink
              prefetch={false}
              href={`/mypage/messages?thread=${encodeURIComponent(profile.profileId)}&recipientName=${encodeURIComponent(profile.name)}&recipientWorkplace=${encodeURIComponent(profile.workplace)}${profile.avatarUrl ? `&recipientAvatarUrl=${encodeURIComponent(profile.avatarUrl)}` : ""}`}
              aria-label={`${profile.name}에게 대화 보내기`}
              className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-strong)] text-[var(--fg)] transition active:scale-95"
            >
              <MessageCircle size={22} strokeWidth={2.2} />
            </NextLink>
          ) : null}
          <NextLink
            prefetch={false}
            href={`/showroom/${profile.profileId}`}
            aria-label={`${profile.name} 바리스타 쇼룸 보기`}
            className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-strong)] text-[var(--fg)] transition active:scale-95"
          >
            <Store size={22} strokeWidth={2.2} />
          </NextLink>
          <NextLink
            prefetch={false}
            href={`/profile/${profile.profileId}`}
            aria-label={`${profile.name} 공개 프로필 보기`}
            className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-strong)] text-[var(--fg)] transition active:scale-95"
          >
            <UserRound size={22} strokeWidth={2.2} />
          </NextLink>
          {profile.isOwnProfile ? null : (
            <button
              type="button"
              aria-label={favorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
              aria-pressed={favorite}
              disabled={savingFavorite}
              onClick={onFavoriteToggle}
              className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-strong)] text-[var(--accent)] transition active:scale-95 disabled:opacity-60"
            >
              <FavoriteStarIcon filled={favorite} size={22} />
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
