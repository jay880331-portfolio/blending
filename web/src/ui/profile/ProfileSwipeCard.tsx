"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  BadgeCheck,
  BookOpen,
  ChevronRight,
  Download,
  FileText,
  IdCard,
  Pencil,
  Share2,
  X,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import type {
  MemberAccountInfo,
  CareerItem,
  MemberProfile,
  MemberRole,
  PortfolioItem,
  StatusMessage,
} from "@/domain/member/types";
import { isNativeBridgeAvailable, nativeBridge } from "@/bridge/nativeBridge";
import { Avatar } from "@/ui/shared/Avatar";
import { FavoriteStarIcon } from "@/ui/shared/FavoriteStarIcon";
import { listenForBlockedUser } from "@/ui/shared/blockedUserEvent";
import { ProfileQrCode, loadQrious } from "./ProfileQrCode";
import { profileQrUrl } from "./profileQrUrl";
import { ResumeModal } from "./ResumeModal";
import { formatPassportSummary } from "@/domain/passport/passport";
import { enthusiastHomeCard, loggedInHomeCard } from "./homeProfileCard";
import { profileSocialHref } from "./profileSocial";
import {
  InstagramBrandIcon,
  ThreadsBrandIcon,
  YoutubeBrandIcon,
} from "@/ui/shared/SocialBrandIcons";
import { primaryOfficialBadge } from "@/ui/shared/OfficialBadgeList";

const BUSINESS_CARD_LOGO_SRC = "/images/global-loading-pixel-cup-fill.webp";

type ProfileCardPage = 0 | 1 | 2;

type ProfileSwipeCardProps = {
  profile: MemberProfile;
  account?: MemberAccountInfo;
  careers?: CareerItem[];
  portfolios?: PortfolioItem[];
  initialPage?: ProfileCardPage;
  editHref?: string;
  favoriteHref?: string;
  blockedRedirectHref?: string;
  variant?: "default" | "home";
  /** 로그인 홈 전용. 공개 프로필도 variant home을 쓴다. */
  selfHome?: boolean;
};

export function ProfileBioRow({
  bio,
  expanded,
  overflows,
  isHome,
  textRef,
  onToggle,
}: {
  bio: string;
  expanded: boolean;
  overflows: boolean;
  isHome: boolean;
  textRef?: Ref<HTMLSpanElement>;
  onToggle: () => void;
}) {
  const interactive = expanded || overflows;
  const labelClass = isHome
    ? "font-normal text-[var(--fg-subtle)]"
    : "font-bold text-[var(--fg-strong)]";
  const textClass = cn(
    "min-w-0 text-[12px] text-[var(--fg)]",
    isHome ? "leading-normal" : "leading-6",
    expanded
      ? "whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
      : "overflow-hidden text-ellipsis whitespace-nowrap",
  );
  const body = (
    <>
      <span className={labelClass}>자기소개</span>
      <span ref={textRef} className={textClass}>
        {bio}
      </span>
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? "자기소개 접기" : "자기소개 펼치기"}
        onClick={onToggle}
        className="grid w-full grid-cols-[64px_minmax(0,1fr)] gap-3 text-left"
      >
        {body}
      </button>
    );
  }

  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-3">{body}</div>
  );
}

export function ProfileSwipeCard({
  profile,
  account,
  careers = [],
  portfolios = [],
  initialPage = 0,
  editHref,
  favoriteHref,
  blockedRedirectHref,
  variant = "default",
  selfHome = false,
}: ProfileSwipeCardProps) {
  const router = useRouter();
  const isHome = variant === "home";
  const homeCard = loggedInHomeCard({
    variant,
    selfHome,
    role: profile.role,
  });
  const enthusiastHome = homeCard.enthusiastLayout;
  const enthusiastCard = enthusiastHome ? enthusiastHomeCard(profile) : null;
  const homeHeaderBg =
    homeCard.header === "accent" ? "bg-[var(--accent)]" : "bg-[var(--fg)]";
  const homeActionClass =
    homeHeaderBg === "bg-[var(--accent)]"
      ? "h-8 w-5 text-[var(--surface)]"
      : "h-8 w-5 text-[var(--fg-subtle)]";
  const [page, setPage] = useState(initialPage);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [statusTooltip, setStatusTooltip] = useState(false);
  const [badgeTooltip, setBadgeTooltip] = useState(false);
  const [workplaceExpanded, setWorkplaceExpanded] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [bioOverflows, setBioOverflows] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [businessCardOpen, setBusinessCardOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const bioTextRef = useRef<HTMLSpanElement | null>(null);
  const statusTimer = useRef<number | null>(null);
  const status = statusMeta(profile.status);
  const workplaces =
    profile.workplaces.length > 0 ? profile.workplaces : [profile.workplace];
  const workplaceText = workplaceExpanded
    ? workplaces.join(" · ")
    : workplaces[0];
  const equipmentRows = buildEquipmentRows(profile.baristaProfile);
  const preferenceRows = buildPreferenceRows(profile.baristaProfile);
  const hasCoffeeProfile =
    equipmentRows.length > 0 || preferenceRows.length > 0;
  const editProfileHref = profile.isOwnProfile ? editHref : undefined;

  useEffect(() => {
    return () => {
      if (statusTimer.current) window.clearTimeout(statusTimer.current);
    };
  }, []);

  useEffect(
    () =>
      listenForBlockedUser((userId) => {
        if (userId !== profile.id) return;
        setBlocked(true);
        if (blockedRedirectHref) router.replace(blockedRedirectHref);
      }),
    [blockedRedirectHref, profile.id, router],
  );

  useEffect(() => {
    if (!photoOpen) return;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setPhotoOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [photoOpen]);

  useEffect(() => {
    if (!businessCardOpen) return;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setBusinessCardOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [businessCardOpen]);

  useLayoutEffect(() => {
    const measureBioOverflow = () => {
      const bioText = bioTextRef.current;
      if (!bioText) return;
      setBioOverflows(bioText.scrollWidth > bioText.clientWidth + 1);
    };

    if (bioExpanded) return;

    measureBioOverflow();

    const bioText = bioTextRef.current;
    if (!bioText || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measureBioOverflow);
    observer.observe(bioText);
    return () => observer.disconnect();
  }, [bioExpanded, profile.bio]);

  const showStatusTooltip = () => {
    setStatusTooltip(true);
    if (statusTimer.current) window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(
      () => setStatusTooltip(false),
      5000,
    );
  };

  const handleTouchEnd = (clientX: number) => {
    if (touchStart === null) return;
    const distance = clientX - touchStart;
    if (distance < -44)
      setPage((current) => Math.min(current + 1, 2) as ProfileCardPage);
    if (distance > 44)
      setPage((current) => Math.max(current - 1, 0) as ProfileCardPage);
    setTouchStart(null);
  };

  const showProfileDocuments = !enthusiastHome;
  const profileActions =
    showProfileDocuments || editProfileHref ? (
      <div
        className={cn(
          "ml-auto flex shrink-0 items-center",
          isHome ? "gap-3" : "gap-1",
        )}
      >
        {showProfileDocuments ? (
          <button
            type="button"
            aria-label="명함으로 변환"
            title="명함으로 변환"
            onClick={(event) => {
              event.stopPropagation();
              setBusinessCardOpen(true);
            }}
            className={cn(
              "flex items-center justify-center transition active:scale-95",
              isHome ? homeActionClass : "h-10 w-10 text-[var(--fg-muted)]",
            )}
          >
            <IdCard size={20} strokeWidth={2.2} />
          </button>
        ) : null}
        {showProfileDocuments ? (
          <button
            type="button"
            aria-label="이력서 보기"
            title="이력서 보기"
            onClick={(event) => {
              event.stopPropagation();
              setResumeOpen(true);
            }}
            className={cn(
              "flex items-center justify-center transition active:scale-95",
              isHome ? homeActionClass : "h-10 w-10 text-[var(--fg-muted)]",
            )}
          >
            <FileText size={20} strokeWidth={2.2} />
          </button>
        ) : null}
        {editProfileHref ? (
          <Link
            prefetch={false}
            href={editProfileHref}
            aria-label="프로필 수정"
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "flex items-center justify-center",
              isHome ? homeActionClass : "h-10 w-10 text-[var(--fg-muted)]",
            )}
          >
            <Pencil size={20} strokeWidth={2.2} />
          </Link>
        ) : null}
      </div>
    ) : null;

  if (blocked) return null;

  return (
    <article
      onClick={() => setBadgeTooltip(false)}
      onTouchStart={(event) => setTouchStart(event.touches[0]?.clientX ?? null)}
      onTouchEnd={(event) =>
        handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)
      }
      className={cn(
        "overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface)]",
        isHome ? "border border-[var(--border)]" : "border border-[var(--fg)]",
        isHome && "relative",
      )}
    >
      <div
        className={cn(
          !isHome && "flex transition-transform duration-300 ease-out",
        )}
        style={
          isHome ? undefined : { transform: `translateX(-${page * 100}%)` }
        }
      >
        {!isHome || page === 0 ? (
          <div
            className={cn(
              "w-full min-w-0 shrink-0",
              isHome ? "pt-0" : "px-5 pb-3 pt-4",
            )}
          >
            <div
              className={cn(
                isHome
                  ? `${homeHeaderBg} px-5 py-4 text-[var(--surface)]`
                  : "mb-4 border-b border-[var(--fg)] pb-3",
              )}
            >
              <div
                className={cn(
                  "relative flex items-center",
                  isHome ? "gap-4" : "gap-3",
                )}
              >
                {isHome ? (
                  <ProfilePhotoButton
                    profile={profile}
                    size="sm"
                    loading="eager"
                    onOpen={() => setPhotoOpen(true)}
                  />
                ) : null}
                <button
                  type="button"
                  aria-label={`${status.label} 상태 보기`}
                  onClick={(event) => {
                    event.stopPropagation();
                    showStatusTooltip();
                  }}
                  className={cn(
                    "h-3 w-3 shrink-0 rounded-[var(--radius-pill)]",
                    status.dot,
                    isHome && "hidden",
                  )}
                />
                {statusTooltip ? (
                  <div className="absolute left-0 top-8 z-10 max-w-[240px] rounded-[var(--radius-lg)] bg-[var(--fg)] px-3 py-2 text-[12px] leading-5 text-[var(--surface)] shadow-[var(--shadow-modal)]">
                    {status.description}
                  </div>
                ) : null}
                <div
                  className={cn(
                    "relative min-w-0 flex-1",
                    isHome && "flex flex-col gap-1",
                  )}
                >
                  {isHome ? (
                    <span
                      className={cn(
                        "text-[11px] font-bold leading-none tracking-[0.16em]",
                        homeHeaderBg === "bg-[var(--accent)]"
                          ? "text-[var(--surface)]"
                          : "text-[var(--fg-subtle)]",
                      )}
                    >
                      {roleLabel(profile.role).toUpperCase()}
                    </span>
                  ) : null}
                  <div
                    className={cn(
                      "flex min-w-0 items-center",
                      isHome ? "gap-[7px]" : "gap-2",
                    )}
                  >
                    <h2
                      className={cn(
                        "min-w-0 truncate font-bold tracking-[-0.01em]",
                        isHome
                          ? "text-[17px] leading-none text-[var(--surface)]"
                          : "text-[20px] text-[var(--fg-strong)]",
                      )}
                    >
                      {enthusiastCard?.nickname ?? profile.name}
                    </h2>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setBadgeTooltip((current) => !current);
                      }}
                      className={cn(
                        "shrink-0 rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-2 py-0.5 text-[12px] font-bold tracking-[0.16em] text-[var(--fg)]",
                        isHome && "hidden",
                      )}
                    >
                      {roleLabel(profile.role)}
                    </button>
                    {profile.certificateName && !enthusiastHome ? (
                      <button
                        type="button"
                        aria-label={`${profile.certificateName} 인증 뱃지`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setBadgeTooltip((current) => !current);
                        }}
                        className={cn(
                          "flex shrink-0 items-center justify-center text-[var(--accent)]",
                          isHome ? "h-4 w-4" : "h-6 w-6",
                        )}
                      >
                        {isHome ? (
                          <BadgeCheck
                            size={16}
                            fill={
                              homeHeaderBg === "bg-[var(--accent)]"
                                ? "var(--surface)"
                                : "var(--accent)"
                            }
                            stroke={
                              homeHeaderBg === "bg-[var(--accent)]"
                                ? "var(--accent)"
                                : "var(--fg)"
                            }
                            strokeWidth={2.2}
                          />
                        ) : (
                          <Award size={16} strokeWidth={2.2} />
                        )}
                      </button>
                    ) : null}
                    {!isHome ? profileActions : null}
                  </div>
                  {badgeTooltip && profile.certificateName ? (
                    <span className="absolute left-0 top-9 z-10 w-48 rounded-[var(--radius-lg)] bg-[var(--fg)] px-3 py-2 text-left text-[12px] font-medium leading-5 tracking-normal text-[var(--surface)] shadow-[var(--shadow-modal)]">
                      {profile.certificateName}
                    </span>
                  ) : null}
                </div>
                {isHome ? profileActions : null}
              </div>
            </div>

            <div
              className={cn(
                "px-5",
                isHome && "py-5",
                !isHome && "grid grid-cols-[112px_minmax(0,1fr)] gap-4 px-0",
              )}
            >
              {!isHome ? (
                <ProfilePhotoButton
                  profile={profile}
                  size="lg"
                  loading="eager"
                  onOpen={() => setPhotoOpen(true)}
                />
              ) : null}
              <div
                className={cn(
                  "min-w-0 space-y-2 text-[12px]",
                  isHome ? "leading-normal" : "leading-6",
                )}
              >
                {enthusiastHome ? (
                  <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-3">
                    <p className="font-normal text-[var(--fg-subtle)]">
                      활동 지역
                    </p>
                    <p className="min-w-0 text-[var(--fg)]">
                      {enthusiastCard?.activityRegion}
                    </p>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setWorkplaceExpanded((current) => !current)
                      }
                      className="grid w-full grid-cols-[64px_minmax(0,1fr)] gap-3 text-left"
                    >
                      <span
                        className={
                          isHome
                            ? "font-normal text-[var(--fg-subtle)]"
                            : "font-bold text-[var(--fg-strong)]"
                        }
                      >
                        소속
                      </span>
                      <span className="min-w-0 truncate text-[var(--fg)]">
                        {workplaceText}
                        {workplaces.length > 1 ? (
                          <span className="ml-2 text-[12px] text-[var(--fg-muted)]">
                            {workplaceExpanded
                              ? "접기"
                              : `+${workplaces.length - 1}`}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-3">
                      <p
                        className={
                          isHome
                            ? "font-normal text-[var(--fg-subtle)]"
                            : "font-bold text-[var(--fg-strong)]"
                        }
                      >
                        전문분야
                      </p>
                      <p className="min-w-0 text-[var(--fg)]">
                        {profile.specialties.length > 0 ? (
                          profile.specialties.slice(0, 5).join(" · ")
                        ) : (
                          <span className="text-[var(--fg-subtle)]">
                            등록 전
                          </span>
                        )}
                      </p>
                    </div>
                  </>
                )}
                <ProfileBioRow
                  bio={
                    enthusiastHome
                      ? (enthusiastCard?.bio ?? "등록 전")
                      : profile.bio
                  }
                  expanded={bioExpanded}
                  overflows={bioOverflows}
                  isHome={isHome}
                  textRef={bioTextRef}
                  onToggle={() => setBioExpanded((current) => !current)}
                />
              </div>
            </div>

            <div
              className={cn(
                "flex items-center text-[12px] font-medium",
                isHome
                  ? "px-5 pb-[18px] leading-normal text-[var(--fg-muted)]"
                  : "mx-5 mt-4 gap-1.5 border-t border-[var(--fg)] pt-3",
              )}
            >
              {!isHome ? (
                <FavoriteStarIcon className="text-[var(--accent)]" size={17} />
              ) : null}
              {favoriteHref ? (
                <Link
                  prefetch={false}
                  href={favoriteHref}
                  className={cn(
                    "font-bold",
                    isHome
                      ? "text-[var(--fg)] no-underline"
                      : "underline underline-offset-2",
                  )}
                >
                  {formatCompactNumber(profile.favoriteCount)}
                </Link>
              ) : (
                <span className={cn("font-bold", isHome && "text-[var(--fg)]")}>
                  {formatCompactNumber(profile.favoriteCount)}
                </span>
              )}
              명이 즐겨찾기 하는 중
            </div>
          </div>
        ) : null}

        {!isHome || page === 1 ? (
          <div className="w-full min-w-0 shrink-0 p-5">
            <div
              className={cn(
                "mb-4",
                isHome
                  ? `-mx-5 -mt-5 ${homeHeaderBg} px-5 py-[13px]`
                  : "border-b border-[var(--border)] pb-4",
              )}
            >
              <div
                className={cn(
                  "relative flex items-center justify-between",
                  !isHome && "pr-10",
                )}
              >
                <h2
                  className={cn(
                    "font-bold tracking-[-0.01em]",
                    isHome
                      ? "text-[13px] leading-normal text-[var(--surface)]"
                      : "text-[18px] text-[var(--fg-strong)]",
                  )}
                >
                  {enthusiastHome ? "내 취향" : "커피 프로필"}
                </h2>
                {editProfileHref && !isHome ? (
                  <Link
                    prefetch={false}
                    href={editProfileHref}
                    aria-label="커피 프로필 수정"
                    onClick={(event) => event.stopPropagation()}
                    className="absolute -right-5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-[var(--fg-muted)]"
                  >
                    <Pencil size={20} strokeWidth={2.2} />
                  </Link>
                ) : null}
              </div>
            </div>
            {enthusiastHome ? (
              <div className="space-y-4 text-[12px] leading-6">
                <CoffeeProfileBlock title="취향 키워드">
                  {enthusiastCard && enthusiastCard.keywords.length > 0 ? (
                    <SelectedChipList values={enthusiastCard.keywords} />
                  ) : (
                    <span className="text-[var(--fg-subtle)]">등록 전</span>
                  )}
                </CoffeeProfileBlock>
                <CoffeeProfileBlock title="선호 뉘앙스">
                  {enthusiastCard && enthusiastCard.nuances.length > 0 ? (
                    <SelectedChipList values={enthusiastCard.nuances} />
                  ) : (
                    <span className="text-[var(--fg-subtle)]">등록 전</span>
                  )}
                </CoffeeProfileBlock>
                <Link
                  prefetch={false}
                  href="/passport"
                  onClick={(event) => event.stopPropagation()}
                  className="flex min-h-12 items-center gap-2.5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[var(--fg)]"
                >
                  <BookOpen size={18} aria-hidden="true" />
                  <span className="text-[13px] font-bold text-[var(--fg-strong)]">
                    커피 여권
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--fg-muted)]">
                    ·{" "}
                    {profile.passport
                      ? `${formatPassportSummary(profile.passport)}${
                          profile.passportSummary
                            ? ` · 스탬프 ${profile.passportSummary.totalStamps}개 · ${profile.passportSummary.balance.toLocaleString("ko-KR")}P`
                            : ""
                        }`
                      : "커피 여권 발급"}
                  </span>
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-[var(--fg-muted)]"
                    aria-hidden="true"
                  />
                </Link>
              </div>
            ) : hasCoffeeProfile ? (
              <div className="space-y-4 text-[12px] leading-6">
                {equipmentRows.length > 0 ? (
                  <CoffeeProfileBlock title="장비">
                    {equipmentRows.map((row) => (
                      <CompactInfoRow
                        key={row.label}
                        label={row.label}
                        values={row.values}
                      />
                    ))}
                  </CoffeeProfileBlock>
                ) : null}
                {preferenceRows.map((row) => (
                  <CoffeeProfileBlock key={row.label} title={row.label}>
                    <SelectedChipList values={row.values} />
                  </CoffeeProfileBlock>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[180px] items-center justify-center text-center text-[12px] font-medium leading-6 text-[var(--fg-subtle)]">
                선택한 장비와 원두 취향이 아직 없어요.
              </div>
            )}
          </div>
        ) : null}

        {!isHome || page === 2 ? (
          <div className="w-full min-w-0 shrink-0 p-5">
            <div
              className={cn(
                "mb-4",
                isHome
                  ? `-mx-5 -mt-5 ${homeHeaderBg} px-5 py-[13px]`
                  : "border-b border-[var(--border)] pb-4",
              )}
            >
              <div
                className={cn(
                  "relative flex items-center justify-between",
                  !isHome && "pr-10",
                )}
              >
                <h2
                  className={cn(
                    "font-bold tracking-[-0.01em]",
                    isHome
                      ? "text-[13px] leading-normal text-[var(--surface)]"
                      : "text-[18px] text-[var(--fg-strong)]",
                  )}
                >
                  소셜 정보
                </h2>
                {editProfileHref && !isHome ? (
                  <Link
                    prefetch={false}
                    href={editProfileHref}
                    aria-label="소셜 정보 수정"
                    onClick={(event) => event.stopPropagation()}
                    className="absolute -right-5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-[var(--fg-muted)]"
                  >
                    <Pencil size={20} strokeWidth={2.2} />
                  </Link>
                ) : null}
              </div>
            </div>
            <div className="min-w-0 space-y-4 text-[12px] leading-6 text-[var(--fg-muted)]">
              <SocialLine
                icon={<InstagramBrandIcon className="h-6 w-6" />}
                value={profile.socials.instagram}
                href={profileSocialHref(profile.socials.instagram, "instagram")}
              />
              <SocialLine
                icon={<ThreadsBrandIcon className="h-6 w-6" />}
                value={profile.socials.threads}
                href={profileSocialHref(profile.socials.threads, "threads")}
              />
              <SocialLine
                icon={<YoutubeBrandIcon className="h-6 w-6" />}
                value={profile.socials.website}
                href={profileSocialHref(profile.socials.website, "website")}
              />
            </div>
          </div>
        ) : null}
      </div>
      <div
        className={cn(
          "flex",
          isHome
            ? "absolute bottom-[18px] right-5 gap-1"
            : "justify-center gap-2 pb-4",
        )}
      >
        {([0, 1, 2] as const).map((dot) => (
          <button
            key={dot}
            type="button"
            aria-label={`${dot + 1}번째 프로필 카드`}
            onClick={() => setPage(dot)}
            className={cn(
              "rounded-[var(--radius-pill)]",
              isHome ? (page === dot ? "h-1 w-4" : "h-1 w-2") : "h-1.5 w-6",
              page === dot
                ? isHome && homeCard.header === "accent"
                  ? "bg-[var(--accent)]"
                  : "bg-[var(--fg)]"
                : "bg-[var(--border-strong)]",
            )}
          />
        ))}
      </div>
      {photoOpen ? (
        <ProfilePhotoModal
          profile={profile}
          onClose={() => setPhotoOpen(false)}
        />
      ) : null}
      {businessCardOpen ? (
        <BusinessCardModal
          profile={profile}
          account={account}
          onClose={() => setBusinessCardOpen(false)}
        />
      ) : null}
      {resumeOpen ? (
        <ResumeModal
          profile={profile}
          account={account}
          careers={careers}
          portfolios={portfolios}
          onClose={() => setResumeOpen(false)}
        />
      ) : null}
    </article>
  );
}

function buildEquipmentRows(profile?: MemberProfile["baristaProfile"]) {
  if (!profile) return [];
  return [
    {
      label: "머신",
      values: formatSelectedBrands(
        profile.espressoMachineBrands,
        profile.espressoMachineBrandOther,
      ),
    },
    {
      label: "그라인더",
      values: formatSelectedBrands(
        profile.grinderBrands,
        profile.grinderBrandOther,
      ),
    },
    {
      label: "로스터기",
      values: formatSelectedBrands(
        profile.roasterBrands,
        profile.roasterBrandOther,
      ),
    },
  ].filter((row) => row.values.length > 0);
}

function buildPreferenceRows(profile?: MemberProfile["baristaProfile"]) {
  if (!profile) return [];
  return [
    {
      label: "원두",
      values: parsePreferredBeans(profile.preferredBeans),
    },
    {
      label: "뉘앙스",
      values: profile.preferredBeanNotes
        .map((note) => note.trim())
        .filter(Boolean),
    },
  ].filter((row) => row.values.length > 0);
}

function formatSelectedBrands(brands: string[], other: string) {
  return brands
    .filter((brand) => brand !== "기타")
    .concat(other.trim() ? [other.trim()] : []);
}

function CoffeeProfileBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid grid-cols-[64px_minmax(0,1fr)] gap-3">
      <h3 className="font-bold text-[var(--fg-strong)]">{title}</h3>
      <div className="min-w-0 space-y-2">{children}</div>
    </section>
  );
}

function CompactInfoRow({
  label,
  values,
}: {
  label: string;
  values: string[];
}) {
  return (
    <div className="grid grid-cols-[62px_minmax(0,1fr)] gap-2">
      <span className="text-[var(--fg-muted)]">{label}</span>
      <SelectedChipList values={values} />
    </div>
  );
}

function SelectedChipList({ values }: { values: string[] }) {
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className="min-w-0 max-w-full rounded-[var(--radius-pill)] border border-[var(--fg)] bg-[var(--fg)] px-3 py-1 text-[12px] font-bold leading-none text-[var(--surface)]"
        >
          <span className="block truncate">{value}</span>
        </span>
      ))}
    </div>
  );
}

function ProfilePhotoButton({
  profile,
  size,
  loading,
  onOpen,
}: {
  profile: MemberProfile;
  size: "sm" | "md" | "lg";
  loading?: "eager" | "lazy";
  onOpen: () => void;
}) {
  const badge = primaryOfficialBadge(profile.officialBadges);
  return (
    <button
      type="button"
      aria-label={`${profile.name} 프로필 이미지 크게 보기`}
      onClick={(event) => {
        event.stopPropagation();
        if (profile.avatarUrl) onOpen();
      }}
      className="relative block transition active:scale-95"
    >
      <Avatar
        size={size}
        src={profile.avatarUrl}
        alt={`${profile.name} 프로필 이미지`}
        loading={loading}
        highlighted={Boolean(badge)}
        badgeName={badge?.name}
        className={size === "sm" ? "!h-[45px] !w-[45px]" : undefined}
      />
    </button>
  );
}

function ProfilePhotoModal({
  profile,
  onClose,
}: {
  profile: MemberProfile;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(255,255,255,0.42)] px-6 py-8 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`${profile.name} 프로필 이미지`}
    >
      <button
        type="button"
        aria-label="프로필 이미지 닫기"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] bg-[rgba(255,255,255,0.82)] text-[var(--fg-muted)] shadow-[var(--shadow-card)] transition active:scale-95"
      >
        <X size={22} />
      </button>
      <div className="relative z-10 flex flex-col items-center gap-4">
        {profile.avatarUrl ? (
          <Image
            src={profile.avatarUrl}
            alt={`${profile.name} 프로필 이미지 확대`}
            width={320}
            height={320}
            sizes="(max-width: 480px) 70vw, 320px"
            className="h-[min(70vw,320px)] w-[min(70vw,320px)] rounded-[var(--radius-pill)] border border-[rgba(255,255,255,0.72)] object-cover shadow-[0_16px_48px_rgba(0,0,0,0.18)]"
          />
        ) : null}
        <p className="rounded-[var(--radius-pill)] bg-[rgba(255,255,255,0.82)] px-4 py-2 text-[16px] font-bold text-[var(--fg-strong)] shadow-[var(--shadow-card)]">
          {profile.name}
        </p>
      </div>
    </div>
  );
}

export function BusinessCardActions({
  onSavePdf,
  onShare,
  onClose,
}: {
  onSavePdf: () => void;
  onShare: () => void;
  onClose: () => void;
}) {
  const buttonClassName =
    "business-card-action-button flex h-11 w-11 items-center justify-center rounded-full border border-[#e2e6df] bg-white text-[#0b0f1a] shadow-[0_8px_24px_rgba(10,15,10,0.18)] transition active:scale-95";

  return (
    <div className="business-card-print-actions sticky top-[calc(env(safe-area-inset-top)+16px)] z-[60] mb-4 flex h-11 justify-end gap-2">
      <button
        type="button"
        aria-label="PDF로 저장"
        title="PDF로 저장"
        onClick={onSavePdf}
        className={buttonClassName}
      >
        <Download size={20} strokeWidth={2.2} />
      </button>
      <button
        type="button"
        aria-label="명함 공유"
        title="명함 공유"
        onClick={onShare}
        className={buttonClassName}
      >
        <Share2 size={20} strokeWidth={2.2} />
      </button>
      <button
        type="button"
        aria-label="닫기"
        title="닫기"
        onClick={onClose}
        className={buttonClassName}
      >
        <X size={22} strokeWidth={2.2} />
      </button>
    </div>
  );
}

function BusinessCardModal({
  profile,
  account,
  onClose,
}: {
  profile: MemberProfile;
  account?: MemberAccountInfo;
  onClose: () => void;
}) {
  const rows = buildBusinessCardRows(profile, account);
  const createBusinessCardPng = async () => {
    const blob = await createBusinessCardImageBlob(profile, rows);
    const fileName = `${safeFileName(profile.name)}-card.png`;
    return {
      blob,
      fileName,
      base64: await blobToBase64(blob),
      file: new File([blob], fileName, { type: "image/png" }),
    };
  };
  const createBusinessCardPdf = async () => {
    const png = await createBusinessCardPng();
    const blob = await createImagePdfBlob(png.blob);
    const fileName = `${safeFileName(profile.name)}-card.pdf`;
    return {
      blob,
      fileName,
      base64: await blobToBase64(blob),
      file: new File([blob], fileName, { type: "application/pdf" }),
    };
  };

  const handleShare = async () => {
    try {
      const title = `${profile.name} 명함`;
      const text = `${profile.name} 명함`;
      const png = await createBusinessCardPng();

      if (isNativeBridgeAvailable()) {
        const fileResult = await nativeBridge
          .shareFile({
            title,
            fileName: png.fileName,
            mimeType: "image/png",
            base64: png.base64,
          })
          .catch(() => ({ status: "failed" as const }));
        if (fileResult.status !== "failed") return;
      }

      if (navigator.canShare?.({ files: [png.file] })) {
        await navigator.share({
          title,
          text,
          files: [png.file],
        });
        return;
      }

      downloadBlob(png.blob, png.fileName);
      window.alert("명함 이미지를 저장했습니다.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      window.alert(
        error instanceof Error ? error.message : "명함을 공유하지 못했습니다.",
      );
    }
  };
  const handleSavePdf = async () => {
    try {
      const title = `${profile.name} 명함 PDF`;
      const pdf = await createBusinessCardPdf();

      if (isNativeBridgeAvailable()) {
        const result = await nativeBridge
          .saveFile({
            title,
            fileName: pdf.fileName,
            mimeType: "application/pdf",
            base64: pdf.base64,
          })
          .catch(() => ({ status: "failed" as const }));
        if (result.status !== "failed") return;
      }

      if (navigator.canShare?.({ files: [pdf.file] })) {
        await navigator.share({
          title,
          text: `${profile.name} 명함 PDF`,
          files: [pdf.file],
        });
        return;
      }

      downloadBlob(pdf.blob, pdf.fileName);
      window.alert("명함 PDF를 저장했습니다.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      window.alert(
        error instanceof Error ? error.message : "PDF를 저장하지 못했습니다.",
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex min-h-dvh items-start justify-center overflow-y-auto bg-[#E5E5E5] px-5 pb-[calc(var(--app-safe-area-bottom)+16px)] pt-[calc(env(safe-area-inset-top)+16px)] text-[#1A1A1A] antialiased md:items-center md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`${profile.name} 명함`}
      style={{
        fontFamily:
          "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif",
      }}
    >
      <button
        type="button"
        aria-label="명함 닫기"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div className="business-card-print-root relative z-10 w-full max-w-5xl">
        <BusinessCardActions
          onSavePdf={() => void handleSavePdf()}
          onShare={() => void handleShare()}
          onClose={onClose}
        />
        <div className="flex w-full flex-col items-center justify-center gap-8 md:flex-row">
          <BusinessCardFront profile={profile} />
          <BusinessCardBack profile={profile} rows={rows} />
        </div>
      </div>
    </div>
  );
}

function BusinessCardFront({ profile }: { profile: MemberProfile }) {
  return (
    <section className="relative flex aspect-[9/16] w-full max-w-[320px] flex-col overflow-hidden bg-[#F2F0E9] shadow-2xl">
      <div className="business-card-paper-texture" />
      <div className="relative flex h-[70%] w-full flex-col items-center justify-center pt-8">
        <div
          className="relative mb-10 flex h-[106px] w-[106px] items-center justify-center transition-opacity duration-500"
          data-purpose="logo-display"
          id="logo-wrapper"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="Blending App Pixel Art Logo"
            className="h-auto w-full object-contain mix-blend-multiply [image-rendering:crisp-edges] [image-rendering:pixelated]"
            data-purpose="brand-identity-image"
            src={BUSINESS_CARD_LOGO_SRC}
          />
        </div>
        <h1 className="mb-4 ml-[0.35em] text-[1.8rem] font-bold tracking-[0.35em] text-[#1A1A1A] [font-family:var(--font-logo)]">
          BLENDING
        </h1>
      </div>
      <div className="relative z-20 flex h-[30%] w-full flex-col items-center justify-center bg-[#1A1A1A] px-8 text-center">
        <h2 className="mb-2 max-w-full break-words text-3xl font-bold leading-tight text-[#F2F0E9]">
          {profile.name}
        </h2>
        <p className="text-sm font-medium text-[#DDDDDD]">
          {businessCardWorkplace(profile)}
        </p>
      </div>
    </section>
  );
}

function BusinessCardBack({
  profile,
  rows,
}: {
  profile: MemberProfile;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <section className="relative flex aspect-[9/16] w-full max-w-[320px] flex-col overflow-hidden bg-[#1A1A1A] shadow-2xl">
      <div className="business-card-paper-texture business-card-dark-texture" />
      <div className="relative z-20 flex flex-col gap-6 px-12 pb-36 pt-16">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-4">
            <span className="mt-1 h-[34px] w-[3px] shrink-0 bg-[#444444]" />
            <div className="flex min-w-0 flex-col">
              <h3 className="mb-1 text-base font-bold text-[#F2F0E9]">
                {row.label}
              </h3>
              <p
                className={cn(
                  "break-words text-sm leading-normal text-[#888888]",
                  row.label !== "Address" && "line-clamp-2",
                )}
                title={row.value}
              >
                {row.value}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2">
        <div className="relative p-[10px]">
          <div className="business-card-frame-corner business-card-frame-tl" />
          <div className="business-card-frame-corner business-card-frame-tr" />
          <div className="business-card-frame-corner business-card-frame-bl" />
          <div className="business-card-frame-corner business-card-frame-br" />
          <div className="bg-white">
            <ProfileQrCode profileId={profile.id} />
          </div>
        </div>
      </div>
    </section>
  );
}

async function createBusinessCardImageBlob(
  profile: MemberProfile,
  rows: Array<{ label: string; value: string }>,
) {
  await Promise.all([loadQrious(), document.fonts.ready]);

  const scale = 3;
  const { cardWidth, cardHeight, width, height, frontX, frontY, backX, backY } =
    businessCardImageLayout();
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const context = canvas.getContext("2d");
  if (!context) throw new Error("명함 이미지를 만들 수 없습니다.");

  context.scale(scale, scale);
  context.imageSmoothingEnabled = false;
  context.fillStyle = "#E5E5E5";
  context.fillRect(0, 0, width, height);
  drawBusinessCardFront(
    context,
    profile,
    frontX,
    frontY,
    cardWidth,
    cardHeight,
  );
  drawBusinessCardBack(context, rows, profile, backX, backY);

  const logo = await loadImage(BUSINESS_CARD_LOGO_SRC);
  const logoRect = businessCardLogoRect(logo.naturalWidth, logo.naturalHeight);
  context.drawImage(
    logo,
    frontX + logoRect.x,
    frontY + logoRect.y,
    logoRect.width,
    logoRect.height,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("명함 이미지를 만들 수 없습니다."));
    }, "image/png");
  });
}

export function businessCardImageLayout() {
  const cardWidth = 320;
  const cardHeight = (cardWidth * 16) / 9;
  const gap = 32;
  const padding = 32;
  const size = cardWidth * 2 + gap + padding * 2;
  const y = (size - cardHeight) / 2;

  return {
    cardWidth,
    cardHeight,
    gap,
    width: size,
    height: size,
    frontX: padding,
    frontY: y,
    backX: padding + cardWidth + gap,
    backY: y,
  };
}

export function businessCardLogoRect(imageWidth: number, imageHeight: number) {
  const boxSize = 106;
  const scale = Math.min(boxSize / imageWidth, boxSize / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;

  return {
    x: 107 + (boxSize - width) / 2,
    y: 121 + (boxSize - height) / 2,
    width,
    height,
  };
}

function drawBusinessCardFront(
  context: CanvasRenderingContext2D,
  profile: MemberProfile,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  context.fillStyle = "#F2F0E9";
  context.fillRect(x, y, width, height);

  context.fillStyle = "#1A1A1A";
  context.fillRect(x, y + height * 0.7, width, height * 0.3);

  context.fillStyle = "#1A1A1A";
  context.font = "700 28.8px Galmuri11, Courier New, monospace";
  drawTrackedText(context, "BLENDING", x + width / 2, y + 278, 10);

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#F2F0E9";
  context.font =
    "700 30px Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
  drawEllipsizedText(context, profile.name, x + width / 2, y + 452, 250);

  context.fillStyle = "#DDDDDD";
  context.font =
    "500 14px Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
  drawEllipsizedText(
    context,
    businessCardWorkplace(profile),
    x + width / 2,
    y + 487,
    250,
  );
}

function drawBusinessCardBack(
  context: CanvasRenderingContext2D,
  rows: Array<{ label: string; value: string }>,
  profile: MemberProfile,
  x: number,
  y: number,
) {
  context.fillStyle = "#1A1A1A";
  context.fillRect(x, y, 320, 568.89);

  let rowY = y + 65;
  rows.forEach((row) => {
    context.fillStyle = "#444444";
    context.fillRect(x + 48, rowY + 4, 3, 34);

    context.textAlign = "left";
    context.textBaseline = "top";
    context.fillStyle = "#F2F0E9";
    context.font =
      "700 16px Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
    context.fillText(row.label, x + 75, rowY, 185);

    context.fillStyle = "#888888";
    context.font =
      "400 14px Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
    const lines =
      row.label === "Address"
        ? drawWrappedText(context, row.value, x + 75, rowY + 33, 205, 18)
        : 1;
    if (row.label !== "Address") {
      drawEllipsizedText(context, row.value, x + 75, rowY + 33, 205, "left");
    }
    rowY += 33 + lines * 18 + 22;
  });

  const qrCanvas = document.createElement("canvas");
  const QRious = window.QRious;
  if (!QRious) throw new Error("QR 코드를 만들 수 없습니다.");
  new QRious({
    element: qrCanvas,
    value: profileQrUrl(window.location.origin, profile.id),
    size: 104,
    background: "white",
    foreground: "black",
    level: "H",
  });

  const qrX = x + 113;
  const qrY = y + 415;
  context.strokeStyle = "#F2F0E9";
  context.lineWidth = 3;
  drawQrCorner(context, qrX - 15, qrY - 15, 15, 15, "tl");
  drawQrCorner(context, qrX + 104, qrY - 15, 15, 15, "tr");
  drawQrCorner(context, qrX - 15, qrY + 104, 15, 15, "bl");
  drawQrCorner(context, qrX + 104, qrY + 104, 15, 15, "br");
  context.fillStyle = "#FFFFFF";
  context.fillRect(qrX, qrY, 104, 104);
  context.drawImage(qrCanvas, qrX, qrY, 104, 104);
}

function drawQrCorner(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  corner: "tl" | "tr" | "bl" | "br",
) {
  context.beginPath();
  if (corner === "tl" || corner === "tr") {
    context.moveTo(x, y);
    context.lineTo(x + width, y);
  } else {
    context.moveTo(x, y + height);
    context.lineTo(x + width, y + height);
  }

  if (corner === "tl" || corner === "bl") {
    context.moveTo(x, y);
    context.lineTo(x, y + height);
  } else {
    context.moveTo(x + width, y);
    context.lineTo(x + width, y + height);
  }
  context.stroke();
}

function drawTrackedText(
  context: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  tracking: number,
) {
  const chars = [...text];
  const textWidth =
    chars.reduce((total, char) => total + context.measureText(char).width, 0) +
    Math.max(chars.length - 1, 0) * tracking;
  let x = centerX - textWidth / 2;
  context.textAlign = "left";
  context.textBaseline = "middle";

  chars.forEach((char) => {
    context.fillText(char, x, y);
    x += context.measureText(char).width + tracking;
  });
}

function drawEllipsizedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  align: CanvasTextAlign = "center",
) {
  let nextText = text;
  while (
    nextText.length > 1 &&
    context.measureText(nextText).width > maxWidth
  ) {
    nextText = `${nextText.slice(0, -2)}…`;
  }

  context.textAlign = align;
  context.fillText(nextText, x, y);
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const lines: string[] = [];
  let line = "";

  for (const character of text) {
    const nextLine = `${line}${character}`;
    if (line && context.measureText(nextLine).width > maxWidth) {
      lines.push(line);
      line = character;
    } else {
      line = nextLine;
    }
  }
  if (line) lines.push(line);

  lines.forEach((value, index) =>
    context.fillText(value, x, y + index * lineHeight),
  );
  return Math.max(lines.length, 1);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("명함 이미지를 불러오지 못했습니다."));
    image.src = src;
  });
}

async function createImagePdfBlob(imageBlob: Blob) {
  const url = URL.createObjectURL(imageBlob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("PDF를 만들 수 없습니다.");

    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);

    const jpegBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("PDF를 만들 수 없습니다."));
      }, "image/jpeg");
    });

    return createJpegPdfBlob(
      new Uint8Array(await jpegBlob.arrayBuffer()),
      canvas.width,
      canvas.height,
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function createJpegPdfBlob(
  jpegBytes: Uint8Array,
  imageWidth: number,
  imageHeight: number,
) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let size = 0;
  const append = (chunk: Uint8Array | string) => {
    const bytes = typeof chunk === "string" ? encoder.encode(chunk) : chunk;
    chunks.push(bytes);
    size += bytes.length;
  };
  const object = (body: Array<string | Uint8Array>) => {
    offsets.push(size);
    append(`${offsets.length} 0 obj\n`);
    body.forEach(append);
    append("\nendobj\n");
  };

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 36;
  const scale = Math.min(
    (pageWidth - margin * 2) / imageWidth,
    (pageHeight - margin * 2) / imageHeight,
  );
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  const x = (pageWidth - width) / 2;
  const y = (pageHeight - height) / 2;
  const content = `q\n${width} 0 0 ${height} ${x} ${y} cm\n/Im0 Do\nQ`;

  append("%PDF-1.4\n");
  object(["<< /Type /Catalog /Pages 2 0 R >>"]);
  object(["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"]);
  object([
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  ]);
  object([
    `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
    jpegBytes,
    "\nendstream",
  ]);
  object([`<< /Length ${content.length} >>\nstream\n${content}\nendstream`]);

  const xref = size;
  append(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`);
  offsets.forEach((offset) => {
    append(`${String(offset).padStart(10, "0")} 00000 n \n`);
  });
  append(
    `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`,
  );

  const pdf = new Uint8Array(size);
  let offset = 0;
  chunks.forEach((chunk) => {
    pdf.set(chunk, offset);
    offset += chunk.length;
  });

  return new Blob([pdf], { type: "application/pdf" });
}

function safeFileName(value: string) {
  return (
    value.replace(/[^\w가-힣.-]+/g, "-").replace(/^-+|-+$/g, "") || "profile"
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("명함 파일을 변환하지 못했습니다."));
        return;
      }
      resolve(result.split(",")[1] ?? "");
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(blob);
  });
}

function buildBusinessCardRows(
  profile: MemberProfile,
  account?: MemberAccountInfo,
) {
  const location = profile.workplaceLocations?.[0];
  const address = location
    ? [location.address, location.detailAddress].filter(Boolean).join(" ")
    : "";
  const phone =
    profile.baristaProfile?.contactPhone || account?.phone || "등록 전";
  const email = account?.email || "등록 전";

  return [
    { label: "Name", value: profile.name },
    { label: "Address", value: address || "등록 전" },
    { label: "Number", value: phone },
    { label: "E-mail", value: email },
  ];
}

function businessCardWorkplace(profile: MemberProfile) {
  return (
    profile.workplaces.filter(Boolean).join(" · ") ||
    profile.workplaceLocations
      ?.map((location) => location.name)
      .filter(Boolean)
      .join(" · ") ||
    profile.workplace ||
    "등록 전"
  );
}

function SocialLine({
  icon,
  value,
  href,
}: {
  icon: ReactNode;
  value: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex min-w-0 items-center gap-3"
    >
      <span className="shrink-0 text-[var(--fg)]">{icon}</span>
      <span className="min-w-0 truncate">{value || "등록 전"}</span>
    </a>
  );
}

function roleLabel(role: MemberRole) {
  if (role === "admin") return "ADMIN";
  if (role === "barista") return "BARISTA";
  return role === "partner" ? "PARTNER" : "COFFEE LOVER";
}

function statusMeta(status: StatusMessage) {
  if (status === "job-seeking") {
    return {
      dot: "bg-[var(--info)]",
      label: "커피소통",
      description: "원두 정보, 장비 사용 후기 공유 및 소통해요.",
    };
  }

  if (status === "focused") {
    return {
      dot: "bg-[var(--fg-faint)]",
      label: "업무중",
      description: "현재 매장 업무 및 본업에 집중하고 있어요.",
    };
  }

  return {
    dot: "bg-[var(--success)]",
    label: "제안환영",
    description: "게스트 바리스타, 세미나, 강연 제안 받아요.",
  };
}

function formatCompactNumber(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
  return String(value);
}

function parsePreferredBeans(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,，\n]/)
        .map((bean) => bean.trim())
        .filter(Boolean),
    ),
  );
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
