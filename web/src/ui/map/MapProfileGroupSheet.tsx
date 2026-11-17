import { UserRound, X } from "lucide-react";
import { Avatar } from "@/ui/shared/Avatar";
import { BottomSheet } from "@/ui/shared/BottomSheet";

export type MapProfileGroupSheetProfile = {
  id: string;
  profileId?: string;
  name: string;
  workplace: string;
  avatarUrl?: string;
  online: boolean;
  skills: string[];
};

export function MapProfileGroupSheet<T extends MapProfileGroupSheetProfile>({
  profiles,
  onClose,
  onProfileSelect,
}: {
  profiles: T[];
  onClose: () => void;
  onProfileSelect: (profile: T) => void;
}) {
  const visibleProfiles = profiles.filter((profile, index, allProfiles) => {
    if (!profile.profileId) return true;
    return (
      allProfiles.findIndex((item) => item.profileId === profile.profileId) ===
      index
    );
  });

  return (
    <BottomSheet zIndexClass="z-50" scrollable>
      <div className="flex shrink-0 items-center justify-between gap-4">
        <h2 className="text-[14px] font-medium leading-[1.4] text-[var(--fg-muted)]">
          이 위치의 바리스타 {visibleProfiles.length}명
        </h2>
        <button
          type="button"
          aria-label="바리스타 목록 닫기"
          onClick={onClose}
          className="flex h-11 w-11 shrink-0 items-center justify-center text-[var(--fg-subtle)]"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="min-h-0 overflow-y-auto border-t border-[var(--border)] divide-y divide-[var(--border)]">
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
                {profile.workplace} · {profile.skills[0] ?? "전문 분야 미입력"}
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
