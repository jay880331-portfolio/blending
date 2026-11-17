"use client";

import Link from "next/link";
import { HomeCouponShortcut } from "@/ui/home/HomeCouponShortcut";
import { HomeFavoriteCafesShortcut } from "@/ui/home/HomeFavoriteCafesShortcut";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type ChangeEventHandler,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  BellOff,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  CreditCard,
  Heart,
  ImageIcon,
  ImagePlus,
  Info,
  LoaderCircle,
  LogOut,
  Mail,
  MessageSquare,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SendHorizontal,
  Shield,
  SmilePlus,
  UserRound,
  X,
} from "lucide-react";
import type {
  CareerItem,
  DirectChatRoomSetting,
  DirectMessage,
  FavoriteProfile,
  MemberInterestItem,
  MemberAccountInfo,
  MemberProfile,
  MemberRole,
  MemberSnapshot,
  MyActivityItem,
  MyRecipe,
  NotificationItem,
  NotificationSettingKey,
  NotificationSettings,
  PortfolioItem,
  StatusMessage,
  WorkplaceLocation,
} from "@/domain/member/types";
import {
  normalizeAccountEmail,
  normalizeAccountPhone,
  validateAccountEmail,
  validateAccountPhone,
} from "@/domain/member/accountValidation";
import { formatRelativeTime } from "@/domain/member/dateTime";
import {
  hasCompleteCareerRequiredFields,
  validateCareerDrafts,
} from "@/domain/member/careerValidation";
import {
  BARISTA_SPECIALTIES,
  normalizeBaristaSpecialties,
} from "@/domain/member/specialties";
import type { SearchDocumentType, SearchResult } from "@/domain/search/types";
import { useMemberStore } from "@/store/memberStore";
import { Avatar } from "@/ui/shared/Avatar";
import { AwardSection } from "@/ui/shared/AwardSection";
import { BottomNav } from "@/ui/shared/BottomNav";
import { FavoriteStarIcon } from "@/ui/shared/FavoriteStarIcon";
import { stopGlobalLoading } from "@/ui/shared/GlobalLoadingBar";
import { HeaderIconActions } from "@/ui/shared/HeaderIconActions";
import { ImageAttachmentSection } from "@/ui/shared/ImageAttachmentSection";
import { useImageCropFlow } from "@/ui/shared/ImageCropEditor";
import { ImageDetailSlider } from "@/ui/shared/ImageDetailSlider";
import { ViewCountMeta } from "@/ui/shared/ViewCountMeta";
import {
  isNativeImagePickerAvailable,
  pickNativeImageFiles,
} from "@/ui/shared/nativeImagePicker";
import { selectProfileImage } from "@/ui/home/profileImagePicker";
import { isNativeBridgeAvailable, nativeBridge } from "@/bridge/nativeBridge";
import { notificationHref } from "@/ui/home/memberNotificationNavigation";
import { shouldForceRefreshMemberSnapshot } from "@/ui/home/memberSnapshotRefresh";
import { hasUnreadDirectMessages } from "@/domain/member/unread";
import { getProfileCompletion } from "@/domain/member/profileCompletion";
import { canWriteShowroom } from "@/domain/showroom/access";
import {
  InstagramBrandIcon,
  ThreadsBrandIcon,
  YoutubeBrandIcon,
} from "@/ui/shared/SocialBrandIcons";
import {
  PostcodeSearchField,
  type PostcodeSelection,
} from "@/ui/shared/PostcodeSearchField";
import { TextTabBar } from "@/ui/shared/TextTabBar";
import { TermsConsentCheckbox } from "@/ui/shared/TermsConsentCheckbox";
import { Button } from "@/ui/shared/Button";
import { LinkButton } from "@/ui/shared/LinkButton";
import { Input, Select } from "@/ui/shared/Input";
import { FieldLabel } from "@/ui/shared/Field";
import {
  homeShowsProfessionalSections,
  profileEditCanSave,
  profileEditKeepsStoredProfession,
} from "@/ui/profile/homeProfileCard";
import { ProfileSwipeCard as SharedProfileSwipeCard } from "@/ui/profile/ProfileSwipeCard";
import { HomeThumbnailGrid } from "@/ui/home/HomeThumbnailGrid";
import { fetchMyDailyNotes } from "@/adapters/http/dailyNoteApi";
import {
  mergeDailyNoteFeed,
  type DailyNoteFeedItem,
} from "@/domain/daily-note/dailyNote";
import { ReportDialog } from "@/ui/shared/ReportDialog";
import { ConfirmDialog } from "@/ui/shared/ConfirmDialog";
import { listenForBlockedUser } from "@/ui/shared/blockedUserEvent";
import {
  confirmPhoneVerification,
  changePassword,
  logout,
  registerWithPhone,
  requestPhoneVerification,
} from "@/adapters/http/authApi";
import {
  createPortfolio,
  deleteMemberAccount,
  deletePortfolio,
  updatePortfolio,
  updateMemberCareers,
  updateMemberProfile,
  updateNotificationSettings,
  deleteMemberNotification,
  markMemberNotificationsRead,
  updateMemberAccountEmail,
  updateMemberAccountPhone,
  updateFavoriteProfile,
  updatePortfolioVisibility,
  registerPushToken,
  recordHomeLastSeen,
  markMemberMessagesRead,
  sendMemberMessage,
  leaveMemberChatRoom,
  updateMemberChatRoomSetting,
} from "@/adapters/http/memberMutations";
import { fetchSearchResults } from "@/adapters/http/searchApi";
import {
  fetchPublicFaqs,
  fetchPublicNotices,
  type PublicFaq,
  type PublicNotice,
} from "@/adapters/http/guideContentApi";
import {
  MAX_UPLOAD_IMAGE_SIZE,
  UPLOAD_IMAGE_SIZE_ERROR_MESSAGE,
  uploadImages,
  uploadProfileDocuments,
} from "@/adapters/http/uploadApi";

type MemberArea = "home" | "mypage" | "signup";
type ChatActionSheetKind = "attach" | "emoji" | "room" | null;

type HomeAppProps = {
  area: MemberArea;
  view: string[];
};

type ScreenProps = {
  snapshot?: MemberSnapshot;
  area: MemberArea;
  view: string[];
};

type AttachedImage = {
  id: string;
  url: string;
  name: string;
  size: number;
  file: File;
};

const IMAGE_ACCEPT = "image/jpeg,image/png";
const DOCUMENT_ACCEPT = "application/pdf,image/jpeg,image/png";
const CERTIFICATION_OPTIONS = [
  "SCA",
  "Q-Grader",
  "GCS",
  "IBS",
  "EUCA",
] as const;
const EMPLOYMENT_TYPE_OPTIONS = ["대표", "정규직", "계약직"] as const;
const ESPRESSO_MACHINE_BRAND_OPTIONS = [
  "라마르조꼬(La Marzocco)",
  "시네소(Synesso)",
  "빅토리아 아르두이노(Victoria Arduino)",
  "슬레이어(Slayer)",
  "훼마(Faema)",
  "시모넬리(Nuova Simonelli)",
] as const;
const GRINDER_BRAND_OPTIONS = [
  "말코닉(Mahlkonig)",
  "메져(Mazzer)",
  "안핌(Anfim)",
  "미토스(Mythos)",
  "컴팍(Compak)",
  "유레카(Eureka)",
] as const;
const ROASTER_BRAND_OPTIONS = [
  "프로밧(Probat)",
  "기센(Giesen)",
  "로링(Loring)",
  "스트롱홀드(Stronghold)",
  "이지스터(Easyster)",
  "태환(Proaster)",
] as const;
const BEAN_NOTE_OPTIONS = [
  "산미",
  "고소함",
  "단맛",
  "밸런스",
  "디카페인",
] as const;
const CAREER_YEAR_OPTIONS = Array.from({ length: 60 }, (_, index) =>
  String(new Date().getFullYear() - index),
);
const PORTFOLIO_IMAGE_LIMIT = MAX_UPLOAD_IMAGE_SIZE;
const PORTFOLIO_IMAGE_ATTACHMENT_LIMIT = 6;
const CHAT_IMAGE_ATTACHMENT_LIMIT = 3;

const statusOptions: Array<{
  value: StatusMessage;
  label: string;
  description: string;
}> = [
  {
    value: "guest",
    label: "제안환영",
    description: "게스트 바리스타, 세미나, 강연 제안 받아요.",
  },
  {
    value: "job-seeking",
    label: "커피소통",
    description: "원두 정보, 장비 사용 후기 공유 및 소통해요.",
  },
  {
    value: "focused",
    label: "업무중",
    description: "현재 매장 업무 및 본업에 집중하고 있어요.",
  },
];

const myPageMenuItemClass =
  "grid h-[60px] w-full grid-cols-[minmax(0,1fr)_24px] items-center border-b border-[var(--border)] bg-transparent px-4 text-left font-[var(--font-body)] text-[16px] font-medium leading-[1.5] tracking-0 text-[var(--fg)] last:border-b-0";

const notificationSections: Array<{
  title: string;
  description: string;
  items: Array<{
    id: NotificationSettingKey;
    title: string;
    description: string;
  }>;
}> = [
  {
    title: "활동 알림",
    description: "회원님의 활동과 관련된 중요한 알림을 받습니다.",
    items: [
      {
        id: "communityLikes",
        title: "좋아요 알림",
        description: "내 글과 댓글에 달린 좋아요",
      },
      {
        id: "communityComments",
        title: "댓글 알림",
        description: "내 글에 달린 새 댓글",
      },
      {
        id: "communityReplies",
        title: "답글 알림",
        description: "내 댓글에 달린 답글",
      },
      {
        id: "interestActivity",
        title: "관심 콘텐츠 알림",
        description: "좋아요한 글과 참여한 글의 새 활동",
      },
      {
        id: "eventUpdates",
        title: "이벤트 알림",
        description: "신청한 이벤트와 일정 변경",
      },
      {
        id: "directMessage",
        title: "다이렉트 메시지",
        description: "새로운 메시지 수신 알림",
      },
      {
        id: "accountSecurity",
        title: "계정 보안 알림",
        description: "새로운 기기 로그인 및 보안 업데이트는 항상 수신",
      },
    ],
  },
  {
    title: "혜택 및 마케팅 알림",
    description: "이벤트, 주요 일정 등 유용한 소식을 받아보세요.",
    items: [
      {
        id: "benefitsMarketing",
        title: "혜택 및 마케팅 알림",
        description: "이벤트, 광고 알림",
      },
      {
        id: "nightNotifications",
        title: "야간 수신 동의",
        description: "오후 9시 ~ 오전 8시 사이의 알림",
      },
      {
        id: "shareLocationForTimesale",
        title: "주변 바리스타 타임세일 알림",
        description: "내 위치(반경 3km) 주변 바리스타의 타임세일 소식 받기",
      },
    ],
  },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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

function myRecipeHref(recipe: MyRecipe) {
  return (
    recipe.href ??
    `/community/b-talk/${recipe.id.replace(/^recipe-/, "b-talk-")}`
  );
}

function certificationSelections(value: string) {
  const normalizedValue = value.toLowerCase();
  return CERTIFICATION_OPTIONS.filter((certificate) =>
    normalizedValue.includes(certificate.toLowerCase()),
  );
}

function careerPeriodYears(value: string) {
  const years = value.match(/\d{4}/g) ?? [];
  const startYear = years[0] ?? "";
  return {
    startYear,
    endYear: value.includes("현재") ? "" : (years[1] ?? startYear),
  };
}

function isDefaultSpecialty(skill: string) {
  return BARISTA_SPECIALTIES.some((specialty) => specialty.value === skill);
}

function createAttachedImage(file: File): AttachedImage {
  return {
    id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
    name: file.name,
    size: file.size,
    url: URL.createObjectURL(file),
    file,
  };
}

function createAttachedFile(file: File): AttachedImage {
  return createAttachedImage(file);
}

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function isSupportedImage(file: File) {
  return file.type === "image/jpeg" || file.type === "image/png";
}

function isSupportedDocument(file: File) {
  return (
    file.type === "application/pdf" ||
    file.type === "image/jpeg" ||
    file.type === "image/png"
  );
}

function toggleStringSelection(current: string[], value: string) {
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}

function normalizeBrandSelections(brands: string[], other = "") {
  return Array.from(
    new Set(
      [...brands, other]
        .map((brand) => brand.trim())
        .filter((brand) => brand && brand !== "기타"),
    ),
  );
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

function formatPreferredBeans(beans: string[]) {
  return Array.from(
    new Set(beans.map((bean) => bean.trim()).filter(Boolean)),
  ).join(", ");
}

function formatFileSize(size: number) {
  return `${(size / 1024 / 1024).toFixed(1)}MB`;
}

function locationDisplayName(name: string, address: string) {
  const cleanName = name.trim();
  const cleanAddress = address.trim();
  if (!cleanName) return cleanAddress;
  if (!cleanAddress || cleanName === cleanAddress) return cleanName;
  return `${cleanName} · ${cleanAddress}`;
}

function fullAddress(location: WorkplaceLocation) {
  return [location.address, location.detailAddress]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");
}

function withWorkplaceName(
  location: WorkplaceLocation,
  name: string,
): WorkplaceLocation {
  const cleanName = name.trim() || location.name;
  const cleanAddress = fullAddress(location) || location.address;

  return {
    ...location,
    name: cleanName,
    displayName: locationDisplayName(cleanName, cleanAddress),
  };
}

function filterImageFiles(files: File[], maxSize: number) {
  return files.filter((file) => {
    if (!isSupportedImage(file)) {
      window.alert("JPG, PNG 이미지만 첨부할 수 있습니다.");
      return false;
    }

    if (file.size > maxSize) {
      window.alert(UPLOAD_IMAGE_SIZE_ERROR_MESSAGE);
      return false;
    }

    return true;
  });
}

export async function registerNativePushToken(
  getPushToken: () => ReturnType<typeof nativeBridge.getPushToken>,
  savePushToken: (input: {
    token: string;
    platform: "android" | "ios" | "web" | "unknown";
  }) => Promise<unknown>,
) {
  const result = await getPushToken();
  if (!result.granted) return false;

  await savePushToken({ token: result.token, platform: result.platform });
  return true;
}

export function HomeApp({ area, view }: HomeAppProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const snapshot = useMemberStore((state) => state.snapshot);
  const status = useMemberStore((state) => state.status);
  const error = useMemberStore((state) => state.error);
  const load = useMemberStore((state) => state.load);
  const removeBlockedUser = useMemberStore((state) => state.removeBlockedUser);
  const markNotificationsReadByHref = useMemberStore(
    (state) => state.markNotificationsReadByHref,
  );
  const pushRegisteredRef = useRef(false);
  const pushRegistrationInFlightRef = useRef(false);
  const handledNotificationHrefRef = useRef<string | null>(null);
  const viewRoot = view[0];
  const isEditView =
    area === "home" &&
    ((viewRoot === "profile" && view[1] === "edit") ||
      (viewRoot === "career" && view[1] === "edit") ||
      (viewRoot === "portfolio" && view[1] === "new"));

  useEffect(() => {
    if (area === "signup") return;
    void load({ force: shouldForceRefreshMemberSnapshot(area, [viewRoot]) });
  }, [area, load, viewRoot]);

  useEffect(() => {
    if (area !== "home" || !snapshot) return;

    const ping = () => {
      void recordHomeLastSeen();
    };
    ping();

    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [area, snapshot]);

  useEffect(() => {
    if (area === "signup" || isEditView) return;

    const refreshSnapshot = () => {
      if (document.visibilityState === "visible") {
        void load({ force: true });
      }
    };

    window.addEventListener("focus", refreshSnapshot);
    document.addEventListener("visibilitychange", refreshSnapshot);

    return () => {
      window.removeEventListener("focus", refreshSnapshot);
      document.removeEventListener("visibilitychange", refreshSnapshot);
    };
  }, [area, isEditView, load]);

  useEffect(
    () =>
      listenForBlockedUser((userId) => {
        removeBlockedUser(userId);
        void load({ force: true });
      }),
    [load, removeBlockedUser],
  );

  useEffect(() => {
    if (area !== "signup" && (snapshot || status === "error")) {
      stopGlobalLoading();
    }
  }, [area, snapshot, status]);

  useEffect(() => {
    if (
      area !== "signup" &&
      status === "error" &&
      error === "로그인이 필요합니다."
    ) {
      router.replace("/login");
    }
  }, [area, error, router, status]);

  useEffect(() => {
    if (
      area !== "home" ||
      !snapshot ||
      pushRegisteredRef.current ||
      !isNativeBridgeAvailable()
    )
      return;

    const register = () => {
      if (pushRegisteredRef.current || pushRegistrationInFlightRef.current)
        return;

      pushRegistrationInFlightRef.current = true;
      void registerNativePushToken(
        () => nativeBridge.getPushToken(),
        registerPushToken,
      )
        .then((registered) => {
          pushRegisteredRef.current = registered;
        })
        .catch((error) => {
          console.warn("[push] registration failed", error);
        })
        .finally(() => {
          pushRegistrationInFlightRef.current = false;
        });
    };
    const registerWhenVisible = () => {
      if (document.visibilityState === "visible") register();
    };

    register();
    window.addEventListener("online", register);
    document.addEventListener("visibilitychange", registerWhenVisible);
    return () => {
      window.removeEventListener("online", register);
      document.removeEventListener("visibilitychange", registerWhenVisible);
    };
  }, [area, snapshot]);

  useEffect(() => {
    if (area === "signup" || !snapshot) return;

    const query = searchParams.toString();
    const currentHref = query ? `${pathname}?${query}` : pathname;
    const hasMatchedUnreadNotification = snapshot.notifications.some(
      (notification) =>
        notification.unread && notification.href === currentHref,
    );

    if (
      !hasMatchedUnreadNotification ||
      handledNotificationHrefRef.current === currentHref
    )
      return;

    handledNotificationHrefRef.current = currentHref;
    void markMemberNotificationsRead({ href: currentHref })
      .then(() => markNotificationsReadByHref(currentHref))
      .catch(() => {
        handledNotificationHrefRef.current = null;
      });
  }, [area, markNotificationsReadByHref, pathname, searchParams, snapshot]);

  const showBottomNav =
    (area === "home" && view.length === 0) ||
    (area === "mypage" && view.length === 0);

  if (area === "signup") {
    return (
      <MemberShell active="home" showBottomNav={false}>
        <ScreenRouter area={area} view={view} />
      </MemberShell>
    );
  }

  if (status === "error") {
    return (
      <MemberShell
        active={area === "mypage" ? "mypage" : "home"}
        showBottomNav={showBottomNav}
      >
        <EmptyState
          title="데이터를 불러오지 못했습니다."
          description={error ?? "잠시 후 다시 시도해주세요."}
        />
      </MemberShell>
    );
  }

  if (!snapshot) {
    return (
      <MemberShell
        active={area === "mypage" ? "mypage" : "home"}
        showBottomNav={showBottomNav}
      >
        <div className="space-y-4 px-6 py-8">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-[var(--radius-lg)] bg-[var(--surface-alt)]"
            />
          ))}
        </div>
      </MemberShell>
    );
  }

  return (
    <MemberShell
      active={area === "mypage" ? "mypage" : "home"}
      showBottomNav={showBottomNav}
    >
      <ScreenRouter snapshot={snapshot} area={area} view={view} />
    </MemberShell>
  );
}

function ScreenRouter({ snapshot, area, view }: ScreenProps) {
  const root = view[0];
  const searchParams = useSearchParams();

  if (area === "signup") {
    if (root === "phone") return <SignupPhoneScreen />;
    if (root === "verify") return <SignupVerifyScreen />;
    if (root === "details") return <SignupDetailsScreen />;
    return <SignupTypeScreen />;
  }

  if (!snapshot) return null;

  if (area === "mypage") {
    if (root === "account") return <AccountInfoScreen snapshot={snapshot} />;
    if (root === "notifications")
      return (
        <MyPageSubScreen
          title="알림"
          kind="notifications"
          snapshot={snapshot}
        />
      );
    if (root === "search")
      return <MyPageSubScreen title="검색" kind="search" snapshot={snapshot} />;
    if (root === "messages")
      return (
        <MyPageSubScreen title="대화함" kind="messages" snapshot={snapshot} />
      );
    if (root === "my-posts")
      return (
        <MyPageSubScreen
          title="내가 쓴 글/댓글"
          kind="my-posts"
          snapshot={snapshot}
        />
      );
    if (root === "interests")
      return (
        <MyPageSubScreen
          title="내 관심 글"
          kind="interests"
          snapshot={snapshot}
        />
      );
    if (root === "favorite-baristas")
      return (
        <MyPageSubScreen
          title="즐겨찾기"
          kind="favorite-baristas"
          snapshot={snapshot}
        />
      );
    if (root === "notices")
      return (
        <MyPageSubScreen title="공지사항" kind="notices" snapshot={snapshot} />
      );
    if (root === "faq")
      return (
        <MyPageSubScreen
          title="자주 묻는 질문"
          kind="faq"
          snapshot={snapshot}
        />
      );
    if (root === "notification-settings")
      return (
        <MyPageSubScreen
          title="알림 설정"
          kind="notification-settings"
          snapshot={snapshot}
        />
      );
    if (root === "version")
      return (
        <MyPageSubScreen title="버전 정보" kind="version" snapshot={snapshot} />
      );
    if (root === "withdraw") return <WithdrawScreen />;
    if (root === "recipes")
      return (
        <MyPageSubScreen
          title="나의 레시피"
          kind="recipes"
          snapshot={snapshot}
        />
      );
    if (root === "favorites")
      return (
        <MyPageSubScreen
          title="즐겨찾기"
          kind="favorite-baristas"
          snapshot={snapshot}
        />
      );
    return <MyPageScreen snapshot={snapshot} />;
  }

  if (root === "notifications")
    return (
      <NotificationsScreen
        notifications={snapshot.notifications}
        messages={snapshot.messages}
      />
    );
  if (root === "messages")
    return (
      <HomeMessagesScreen
        messages={snapshot.messages}
        chatRoomSettings={snapshot.chatRoomSettings}
        myProfileId={snapshot.profile.id}
      />
    );
  if (root === "search") return <HomeSearchScreen />;
  if (root === "favorites")
    return (
      <FavoritesScreen
        favorites={snapshot.favorites}
        favoriteFollowers={snapshot.favoriteFollowers}
      />
    );
  if (root === "recipes") return <MyRecipesScreen recipes={snapshot.recipes} />;
  if (root === "social") return <HomeSocialScreen snapshot={snapshot} />;
  if (root === "profile" && view[1] === "edit")
    return <ProfileEditScreen profile={snapshot.profile} />;
  if (root === "career" && view[1] === "edit")
    return <CareerEditScreen careers={snapshot.careers} />;
  if (root === "portfolio" && view[1] === "new") {
    const editId = searchParams.get("edit");
    const portfolio = editId
      ? snapshot.portfolios.find((item) => item.id === editId)
      : undefined;
    return <PortfolioWriteScreen portfolio={portfolio} />;
  }
  if (root === "portfolio" && view[1]) {
    const portfolio = snapshot.portfolios.find((item) => item.id === view[1]);
    if (!portfolio)
      return (
        <EmptyState
          title="포트폴리오를 찾을 수 없습니다."
          description="삭제되었거나 잘못된 주소예요."
        />
      );
    return (
      <PortfolioDetailScreen
        portfolio={portfolio}
        isOwnProfile={snapshot.profile.isOwnProfile}
      />
    );
  }

  return <HomeMainScreen snapshot={snapshot} />;
}

function MemberShell({
  active,
  showBottomNav,
  children,
}: {
  active: "home" | "mypage";
  showBottomNav: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--surface-alt)]">
      <div className="relative mx-auto min-h-screen max-w-[var(--app-shell-max-width)] bg-[var(--bg)] shadow-[0_0_0_1px_var(--border)]">
        <main className={cn(showBottomNav ? "pb-28" : "pb-8")}>{children}</main>
        {showBottomNav ? <BottomNav active={active} /> : null}
      </div>
    </div>
  );
}

function ScreenHeader({
  title,
  logo,
  back = false,
  right,
}: {
  title?: string;
  logo?: boolean;
  back?: boolean;
  right?: ReactNode;
}) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="grid h-16 grid-cols-[84px_1fr_84px] items-center px-2">
        {back ? (
          <button
            type="button"
            aria-label="뒤로가기"
            onClick={() => router.back()}
            className="flex h-11 w-11 items-center justify-center text-[var(--fg)]"
          >
            <ArrowLeft size={25} strokeWidth={2.2} />
          </button>
        ) : (
          <div />
        )}
        {logo ? (
          <Link
            prefetch={false}
            href="/home"
            className="logo-wordmark text-center text-[25px] font-bold text-[var(--fg-strong)]"
          >
            BLENDING
          </Link>
        ) : (
          <h1 className="text-center text-[20px] font-bold tracking-[-0.01em] text-[var(--fg-strong)]">
            {title}
          </h1>
        )}
        <div className="flex items-center justify-center">{right}</div>
      </div>
    </header>
  );
}

function HomeHeader({
  hasUnreadNotifications,
  onNotificationClick,
}: {
  hasUnreadNotifications: boolean;
  onNotificationClick?: () => void;
}) {
  return (
    <ScreenHeader
      logo
      right={
        <HeaderIconActions
          notificationHref="/home/notifications"
          searchHref="/home/search"
          hasUnreadNotifications={hasUnreadNotifications}
          onNotificationClick={onNotificationClick}
        />
      }
    />
  );
}

function MyPageHeader({
  hasUnreadNotifications,
}: {
  hasUnreadNotifications: boolean;
}) {
  return (
    <ScreenHeader
      logo
      right={
        <HeaderIconActions
          notificationHref="/mypage/notifications"
          searchHref="/mypage/search"
          hasUnreadNotifications={hasUnreadNotifications}
        />
      }
    />
  );
}

function HomeMainScreen({ snapshot }: { snapshot: MemberSnapshot }) {
  const storeSnapshot = useMemberStore((state) => state.snapshot);
  const markAllNotificationsRead = useMemberStore(
    (state) => state.markAllNotificationsRead,
  );
  const currentSnapshot = storeSnapshot ?? snapshot;
  const hasUnreadNotifications = currentSnapshot.notifications.some(
    (notification) => notification.unread,
  );

  const handleNotificationClick = () => {
    if (!hasUnreadNotifications) return;
    if (!storeSnapshot && snapshot) {
      useMemberStore.setState({ snapshot });
    }
    void markMemberNotificationsRead().catch(() => {});
    markAllNotificationsRead();
  };

  useEffect(() => {
    const savedScroll = window.sessionStorage.getItem("blending-home-scroll-y");
    if (!savedScroll) return;
    window.sessionStorage.removeItem("blending-home-scroll-y");
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: Number(savedScroll), behavior: "auto" });
    });
  }, []);

  return (
    <>
      <HomeHeader
        hasUnreadNotifications={hasUnreadNotifications}
        onNotificationClick={handleNotificationClick}
      />
      <section className="space-y-3 bg-[var(--surface-alt)] px-4 py-4">
        <SharedProfileSwipeCard
          profile={snapshot.profile}
          account={snapshot.account}
          careers={snapshot.careers}
          portfolios={snapshot.portfolios}
          editHref="/home/profile/edit"
          favoriteHref="/home/favorites"
          variant="home"
          selfHome
        />
        <ProfileCompletionGauge
          profile={snapshot.profile}
          account={snapshot.account}
        />
        {snapshot.profile.role === "enthusiast" ? (
          <>
            <HomeCouponShortcut />
            <HomeFavoriteCafesShortcut />
          </>
        ) : null}
        {snapshot.profile.role === "enthusiast" ? (
          <PortfolioSection
            portfolios={snapshot.portfolios}
            isOwnProfile={snapshot.profile.isOwnProfile}
            home
          />
        ) : null}
        {homeShowsProfessionalSections(snapshot.profile.role) ? (
          <>
            <AwardSection
              careers={snapshot.careers}
              addHref={
                snapshot.profile.isOwnProfile
                  ? "/home/career/edit?type=award"
                  : undefined
              }
            />
            <PortfolioSection
              portfolios={snapshot.portfolios}
              isOwnProfile={snapshot.profile.isOwnProfile}
              home
            />
          </>
        ) : null}
      </section>
    </>
  );
}

function HomeSocialScreen({ snapshot }: { snapshot: MemberSnapshot }) {
  const storeSnapshot = useMemberStore((state) => state.snapshot);
  const markAllNotificationsRead = useMemberStore(
    (state) => state.markAllNotificationsRead,
  );
  const currentSnapshot = storeSnapshot ?? snapshot;
  const hasUnreadNotifications = currentSnapshot.notifications.some(
    (notification) => notification.unread,
  );

  const handleNotificationClick = () => {
    if (!hasUnreadNotifications) return;
    if (!storeSnapshot && snapshot) {
      useMemberStore.setState({ snapshot });
    }
    void markMemberNotificationsRead().catch(() => {});
    markAllNotificationsRead();
  };

  return (
    <>
      <HomeHeader
        hasUnreadNotifications={hasUnreadNotifications}
        onNotificationClick={handleNotificationClick}
      />
      <section className="space-y-3 bg-[var(--surface-alt)] px-4 py-4">
        <SharedProfileSwipeCard
          profile={snapshot.profile}
          account={snapshot.account}
          careers={snapshot.careers}
          portfolios={snapshot.portfolios}
          initialPage={2}
          editHref="/home/profile/edit"
          favoriteHref="/home/favorites"
          variant="home"
          selfHome
        />
        {snapshot.profile.role === "enthusiast" ? (
          <>
            <HomeCouponShortcut />
            <HomeFavoriteCafesShortcut />
          </>
        ) : null}
        {snapshot.profile.role === "enthusiast" ? (
          <PortfolioSection
            portfolios={snapshot.portfolios}
            isOwnProfile={snapshot.profile.isOwnProfile}
            home
          />
        ) : null}
        {homeShowsProfessionalSections(snapshot.profile.role) ? (
          <>
            <AwardSection
              careers={snapshot.careers}
              addHref={
                snapshot.profile.isOwnProfile
                  ? "/home/career/edit?type=award"
                  : undefined
              }
            />
            <PortfolioSection
              portfolios={snapshot.portfolios.slice(1)}
              compact
              isOwnProfile={snapshot.profile.isOwnProfile}
              home
            />
          </>
        ) : null}
      </section>
    </>
  );
}

function ProfileCompletionGauge({
  profile,
  account,
}: {
  profile: MemberProfile;
  account: MemberAccountInfo;
}) {
  const completion = getProfileCompletion(profile, account);
  const storageKey = `blending-profile-completion-dismissed:${profile.id}`;
  const dismissed = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener(storageKey, onStoreChange);
      return () => window.removeEventListener(storageKey, onStoreChange);
    },
    () => window.sessionStorage.getItem(storageKey) === "1",
    () => false,
  );

  if (completion.score === 100 || dismissed) return null;

  const nextItem = completion.missing[0] ?? "프로필 정보";
  return (
    <section className="relative rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <button
        type="button"
        aria-label="프로필 완성도 안내 닫기"
        onClick={() => {
          window.sessionStorage.setItem(storageKey, "1");
          window.dispatchEvent(new Event(storageKey));
        }}
        className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center text-[var(--fg-muted)]"
      >
        <X size={18} />
      </button>
      <div className="flex items-baseline justify-between pr-10">
        <p className="text-[12px] font-medium text-[var(--fg-muted)]">
          프로필 완성도
        </p>
        <p className="text-[16px] font-bold tabular-nums text-[var(--fg-strong)]">
          {completion.score}%
        </p>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--surface-alt)]">
        <span
          className="block h-full bg-[var(--fg)]"
          style={{ width: `${completion.score}%` }}
        />
      </div>
      <p className="mt-2 text-[12px] leading-[1.4] text-[var(--fg-subtle)]">
        {nextItem} 항목을 등록하면 프로필이 더 완성돼요.
      </p>
    </section>
  );
}

const STORY_PAGE_SIZE = 12;

function storyLoadMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "STORY를 불러오지 못했습니다.";
}

function PortfolioSection({
  portfolios,
  compact = false,
  isOwnProfile,
  home = false,
}: {
  portfolios: PortfolioItem[];
  compact?: boolean;
  isOwnProfile: boolean;
  home?: boolean;
}) {
  const portfolioPublic = useMemberStore((state) => state.portfolioPublic);
  const setPortfolioPublic = useMemberStore(
    (state) => state.setPortfolioPublic,
  );
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [notes, setNotes] = useState<DailyNoteFeedItem[]>([]);
  const [loadingMore, setLoadingMore] = useState(home);
  const [storyError, setStoryError] = useState<string | undefined>();
  const [storyReloadKey, setStoryReloadKey] = useState(0);
  const cursorRef = useRef<string | undefined>(undefined);
  const loadingRef = useRef(false);
  const errorRef = useRef<string | undefined>(undefined);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!home) return;
    const requestId = ++requestIdRef.current;
    loadingRef.current = true;
    errorRef.current = undefined;
    void fetchMyDailyNotes(STORY_PAGE_SIZE)
      .then((result) => {
        if (requestIdRef.current !== requestId) return;
        setNotes(result.items);
        cursorRef.current = result.nextCursor;
      })
      .catch((error: unknown) => {
        if (requestIdRef.current !== requestId) return;
        setNotes([]);
        cursorRef.current = undefined;
        const message = storyLoadMessage(error);
        errorRef.current = message;
        setStoryError(message);
      })
      .finally(() => {
        if (requestIdRef.current !== requestId) return;
        loadingRef.current = false;
        setLoadingMore(false);
      });
    return () => {
      requestIdRef.current += 1;
      loadingRef.current = false;
    };
  }, [home, storyReloadKey]);

  const loadMoreStories = useCallback(() => {
    const cursor = cursorRef.current;
    if (loadingRef.current || errorRef.current || !cursor) return;
    const requestId = ++requestIdRef.current;
    loadingRef.current = true;
    setLoadingMore(true);
    void fetchMyDailyNotes(STORY_PAGE_SIZE, cursor)
      .then((result) => {
        if (requestIdRef.current !== requestId) return;
        setNotes((current) => mergeDailyNoteFeed(current, result.items));
        cursorRef.current = result.nextCursor;
      })
      .catch((error: unknown) => {
        if (requestIdRef.current !== requestId) return;
        const message = storyLoadMessage(error);
        errorRef.current = message;
        setStoryError(message);
      })
      .finally(() => {
        if (requestIdRef.current !== requestId) return;
        loadingRef.current = false;
        setLoadingMore(false);
      });
  }, []);

  const retryStories = () => {
    if (notes.length === 0) {
      setLoadingMore(true);
      setStoryError(undefined);
      setStoryReloadKey((key) => key + 1);
      return;
    }
    errorRef.current = undefined;
    setStoryError(undefined);
    loadMoreStories();
  };

  const handlePortfolioVisibilityToggle = async () => {
    if (savingVisibility) return;

    const nextValue = !portfolioPublic;
    setPortfolioPublic(nextValue);
    setSavingVisibility(true);

    try {
      await updatePortfolioVisibility(nextValue);
    } catch (error) {
      setPortfolioPublic(portfolioPublic);
      window.alert(
        error instanceof Error
          ? error.message
          : "포트폴리오 공개 설정 저장에 실패했습니다.",
      );
    } finally {
      setSavingVisibility(false);
    }
  };

  return (
    <section
      className={cn(
        home &&
          "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5",
      )}
    >
      <div className="flex items-center justify-between pb-2">
        <h2
          className={cn(
            "font-bold tracking-[-0.01em] text-[var(--fg-strong)]",
            home ? "text-[16px]" : "text-[18px]",
          )}
        >
          {home ? "STORY" : "포트폴리오"}
        </h2>
        {home ? (
          <Link
            prefetch={false}
            href="/community/daily-note/new?from=home"
            aria-label="STORY 등록"
            className="inline-flex h-11 w-11 items-center justify-center text-[var(--fg)]"
          >
            <Plus size={20} aria-hidden="true" />
          </Link>
        ) : null}
        {isOwnProfile && !home ? (
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "text-[var(--fg-muted)]",
                home ? "text-[12px]" : "text-[14px] text-[var(--fg)]",
              )}
            >
              {portfolioPublic ? "공개" : "비공개"}
            </span>
            <button
              type="button"
              aria-label={`포트폴리오 ${portfolioPublic ? "공개" : "비공개"} 전환`}
              aria-pressed={portfolioPublic}
              disabled={savingVisibility}
              onClick={() => void handlePortfolioVisibilityToggle()}
              className={cn(
                "flex items-center justify-center transition-colors",
                home
                  ? "-my-2.5 h-11 w-11"
                  : "h-7 w-12 rounded-[var(--radius-pill)] p-1",
                !home &&
                  (portfolioPublic
                    ? "justify-end bg-[var(--accent)]"
                    : "justify-start bg-[var(--fg-faint)]"),
                savingVisibility && "opacity-60",
              )}
            >
              {home ? (
                <span
                  className={cn(
                    "flex h-6 w-11 items-center rounded-[var(--radius-pill)] p-0.5",
                    portfolioPublic
                      ? "justify-end bg-[var(--fg)]"
                      : "justify-start bg-[var(--fg-faint)]",
                  )}
                >
                  <span className="h-5 w-5 rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--surface)]" />
                </span>
              ) : (
                <span className="h-5 w-5 rounded-[var(--radius-pill)] bg-[var(--surface)]" />
              )}
            </button>
            {!home ? (
              <Link
                prefetch={false}
                href="/home/portfolio/new"
                aria-label="포트폴리오 추가"
                className="flex h-10 w-10 items-center justify-center text-[var(--fg-muted)]"
              >
                <Pencil size={20} strokeWidth={2.2} />
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="mt-2">
        {home ? (
          <>
            <HomeThumbnailGrid
              tiles={notes.map((note) => ({
                id: note.id,
                href: `/community/daily-note/${note.id}`,
                image: (
                  <ImageBox
                    src={note.imageUrls[0]}
                    alt="STORY"
                    className="h-full w-full rounded-none"
                  />
                ),
              }))}
              onReachEnd={loadMoreStories}
            />
            {loadingMore ? (
              <p className="py-3 text-center text-[12px] font-medium text-[var(--fg-muted)]">
                불러오는 중
              </p>
            ) : null}
            {storyError ? (
              <div className="py-3 text-center">
                <p className="text-[14px] font-bold text-[var(--fg-muted)]">
                  {storyError}
                </p>
                <button
                  type="button"
                  onClick={retryStories}
                  className="mt-2 text-[14px] font-bold text-[var(--accent)]"
                >
                  다시 시도
                </button>
              </div>
            ) : null}
          </>
        ) : portfolios.length === 0 ? (
          <EmptyState title="등록된 내역이 없습니다" />
        ) : (
          portfolios.map((portfolio) => (
            <PortfolioRow
              key={portfolio.id}
              portfolio={portfolio}
              compact={compact}
            />
          ))
        )}
      </div>
    </section>
  );
}

function PortfolioRow({
  portfolio,
  compact,
}: {
  portfolio: PortfolioItem;
  compact?: boolean;
}) {
  const preserveScroll = () =>
    window.sessionStorage.setItem(
      "blending-home-scroll-y",
      String(window.scrollY),
    );

  return (
    <article
      className={cn(
        "grid grid-cols-[84px_minmax(0,1fr)_52px] gap-4 py-3",
        compact && "py-2",
      )}
    >
      <Link
        prefetch={false}
        href={`/home/portfolio/${portfolio.id}`}
        onClick={preserveScroll}
        className="block"
      >
        <ImageBox
          src={portfolio.imageUrls[0]}
          alt={portfolio.title}
          className="h-[84px] rounded-[var(--radius-sm)]"
        />
      </Link>
      <div className="min-w-0 pt-1">
        <Link
          prefetch={false}
          href={`/home/portfolio/${portfolio.id}`}
          onClick={preserveScroll}
          className="block min-w-0"
        >
          <h3 className="line-clamp-2 text-[16px] font-bold leading-snug text-[var(--fg-strong)]">
            {portfolio.title}
          </h3>
          <p className="mt-2 text-[12px] text-[var(--fg-muted)]">
            {portfolio.createdAt}
          </p>
          <PortfolioSummaryPreview summary={portfolio.summary} />
        </Link>
      </div>
      <Link
        prefetch={false}
        href={`/home/portfolio/${portfolio.id}`}
        aria-label={`${portfolio.title} 상세 보기`}
        onClick={preserveScroll}
        className="flex h-10 w-[52px] items-center justify-end justify-self-end self-start pt-1 text-[var(--fg-muted)]"
      >
        <ChevronRight size={20} strokeWidth={2.1} />
      </Link>
    </article>
  );
}

function PortfolioSummaryPreview({ summary }: { summary: string }) {
  return (
    <p className="mt-2 line-clamp-2 text-[12px] leading-6 text-[var(--fg-muted)]">
      {summary}
    </p>
  );
}

function PortfolioActionsMenu({ portfolio }: { portfolio: PortfolioItem }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const removePortfolio = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deletePortfolio(portfolio.id);
      window.location.assign("/home");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="relative mt-1">
      <button
        type="button"
        aria-label={`${portfolio.title} 수정 또는 삭제`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-8 w-8 items-center justify-center text-[var(--fg-muted)]"
      >
        <MoreVertical size={20} />
      </button>
      {open ? (
        <div className="absolute right-0 top-9 z-20 w-28 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-modal)]">
          <Link
            prefetch={false}
            href={`/home/portfolio/new?edit=${portfolio.id}`}
            className="portfolio-action-menu-item text-[var(--fg)]"
          >
            수정하기
          </Link>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={deleting}
            className="portfolio-action-menu-item text-[var(--accent)]"
          >
            {deleting ? "삭제 중" : "삭제하기"}
          </button>
        </div>
      ) : null}
      {confirmOpen ? (
        <ConfirmDialog
          onCancel={() => setConfirmOpen(false)}
          onConfirm={removePortfolio}
        />
      ) : null}
    </div>
  );
}

function NotificationsScreen({
  notifications,
  messages,
}: {
  notifications: NotificationItem[];
  messages: DirectMessage[];
}) {
  return (
    <div className="member-slide-page min-h-screen w-full overflow-x-hidden bg-[var(--bg)]">
      <HomeSubHeader title="알림" />
      <NotificationsScreenBody
        notifications={notifications}
        messages={messages}
        messageBasePath="/home/messages"
      />
    </div>
  );
}

function HomeMessagesScreen({
  messages,
  chatRoomSettings,
  myProfileId,
}: {
  messages: DirectMessage[];
  chatRoomSettings: DirectChatRoomSetting[];
  myProfileId: string;
}) {
  return (
    <MessageScreenBody
      messages={messages}
      chatRoomSettings={chatRoomSettings}
      myProfileId={myProfileId}
    />
  );
}

function NotificationIcon({
  item,
  avatarUrl,
}: {
  item: NotificationItem;
  avatarUrl?: string;
}) {
  if (item.kind === "message") {
    if (avatarUrl) {
      return (
        <span
          aria-hidden="true"
          className="h-12 w-12 rounded-[var(--radius-pill)] bg-cover bg-center"
          style={{ backgroundImage: `url(${avatarUrl})` }}
        />
      );
    }
    return (
      <div className="flex h-12 w-12 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--fg-muted)]">
        <Mail size={22} />
      </div>
    );
  }

  if (item.kind === "notice" || item.kind === "reservation") {
    return (
      <div className="flex h-12 w-12 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--fg-muted)]">
        <Info size={22} />
      </div>
    );
  }

  return <Avatar size="sm" />;
}

type NotificationListItem = {
  item: NotificationItem;
  notificationIds: string[];
  title: string;
  createdAgo: string;
  preview?: string;
  unreadCount: number;
  avatarUrl?: string;
};

function notificationThreadId(item: NotificationItem) {
  if (item.kind !== "message" || !item.href) return null;
  try {
    return new URL(item.href, "http://localhost").searchParams.get("thread");
  } catch {
    return null;
  }
}

function buildNotificationListItems(
  notifications: NotificationItem[],
  messages: DirectMessage[],
): NotificationListItem[] {
  const latestMessageBySender = new Map<string, DirectMessage>();
  messages.forEach((message) => {
    if (!latestMessageBySender.has(message.senderId))
      latestMessageBySender.set(message.senderId, message);
  });

  const grouped = new Map<string, NotificationListItem>();
  notifications.forEach((item) => {
    const threadId = notificationThreadId(item);
    if (!threadId) {
      grouped.set(item.id, {
        item,
        notificationIds: [item.id],
        title: item.title,
        createdAgo: item.createdAgo,
        unreadCount: item.unread ? 1 : 0,
      });
      return;
    }

    const message = latestMessageBySender.get(threadId);
    const current = grouped.get(threadId);
    if (current) {
      current.notificationIds.push(item.id);
      current.unreadCount += item.unread ? 1 : 0;
      return;
    }

    grouped.set(threadId, {
      item,
      notificationIds: [item.id],
      title:
        message?.senderName ??
        item.title.replace(/님이 대화를 보냈습니다\.?$/, ""),
      createdAgo: item.createdAgo,
      preview:
        message?.body ||
        (message?.imageUrls?.length ? "사진을 보냈습니다." : undefined),
      unreadCount: item.unread ? 1 : 0,
      avatarUrl: message?.senderAvatarUrl,
    });
  });

  return Array.from(grouped.values());
}

function FavoritesScreen({
  favorites,
  favoriteFollowers,
}: {
  favorites: FavoriteProfile[];
  favoriteFollowers: FavoriteProfile[];
}) {
  return (
    <div className="member-slide-page min-h-screen bg-[var(--bg)]">
      <HomeSubHeader title="즐겨찾기" />
      <FavoritesScreenBody
        favorites={favorites}
        favoriteFollowers={favoriteFollowers}
      />
    </div>
  );
}

function MyRecipesScreen({ recipes }: { recipes: MyRecipe[] }) {
  const recipeLikes = useMemberStore((state) => state.recipeLikes);
  const toggleRecipeLike = useMemberStore((state) => state.toggleRecipeLike);

  return (
    <div className="member-slide-page min-h-screen bg-[var(--bg)]">
      <HomeSubHeader title="나의 레시피" />
      <section className="space-y-6 px-6 py-8">
        {recipes.map((recipe) => {
          const liked = recipeLikes[recipe.id] ?? recipe.liked;
          return (
            <article
              key={recipe.id}
              className="grid grid-cols-[136px_1fr_36px] gap-5 rounded-[var(--radius-lg)] border border-[var(--border-strong)] p-5"
            >
              <Link prefetch={false} href={myRecipeHref(recipe)}>
                <ImageBox
                  src={recipe.imageUrl}
                  alt={recipe.title}
                  className="aspect-square"
                />
              </Link>
              <Link
                prefetch={false}
                href={myRecipeHref(recipe)}
                className="min-w-0"
              >
                <h2 className="line-clamp-2 text-[18px] font-bold leading-[1.3] text-[var(--fg-strong)]">
                  {recipe.title}
                </h2>
                <p className="mt-2 line-clamp-2 text-[14px] leading-6 text-[var(--fg-muted)]">
                  {recipe.summary}
                </p>
                <p className="mt-3 text-[13px] leading-[1.5] text-[var(--fg-muted)]">
                  {recipe.createdAt}
                </p>
              </Link>
              <button
                type="button"
                aria-label="레시피 좋아요"
                onClick={() => toggleRecipeLike(recipe.id, recipe.liked)}
                className={cn(
                  "self-end text-[var(--fg-muted)]",
                  liked && "text-[var(--accent)]",
                )}
              >
                <Heart size={23} fill={liked ? "currentColor" : "none"} />
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function HomeSearchScreen() {
  return (
    <div className="member-slide-page min-h-screen bg-[var(--bg)]">
      <HomeSubHeader title="검색" />
      <SearchScreenBody />
    </div>
  );
}

function MyPageScreen({ snapshot }: { snapshot: MemberSnapshot }) {
  const { profile } = snapshot;
  const hasUnreadNotifications = snapshot.notifications.some(
    (notification) => notification.unread,
  );
  const hasUnreadMessages = hasUnreadDirectMessages({
    messages: snapshot.messages,
    memberId: snapshot.profile.id,
  });
  const [confirmAction, setConfirmAction] = useState<"logout" | null>(null);
  const menuGroups = [
    {
      title: "나의 블렌딩",
      items: [
        { label: "내가 쓴 글/댓글", href: "/mypage/my-posts" },
        { label: "내 관심 글", href: "/mypage/interests" },
        { label: "즐겨찾기 한 바리스타", href: "/mypage/favorite-baristas" },
        { label: "내 쿠폰함", href: "/showroom/coupons" },
        ...(canWriteShowroom(profile.role)
          ? [
              { label: "내 쇼룸 관리", href: "/showroom/manage" },
              { label: "직원 쿠폰 스캔", href: "/showroom/scan" },
              { label: "매장 직원 신청", href: "/showroom/staff-apply" },
            ]
          : []),
      ],
    },
    {
      title: "안내",
      items: [
        { label: "공지사항", href: "/mypage/notices" },
        { label: "자주 묻는 질문", href: "/mypage/faq" },
      ],
    },
    {
      title: "앱 설정",
      items: [
        { label: "알림 설정", href: "/mypage/notification-settings" },
        { label: "버전 정보", href: "/mypage/version" },
        { label: "로그아웃", action: "logout" as const },
      ],
    },
  ];

  return (
    <>
      <MyPageHeader hasUnreadNotifications={hasUnreadNotifications} />
      <section className="min-h-[calc(100dvh-128px)] space-y-5 bg-[var(--surface-alt)] px-4 py-4 pb-8">
        <div className="grid min-h-[112px] grid-cols-[64px_minmax(0,1fr)_48px] items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
          <Link
            prefetch={false}
            href="/mypage/account"
            aria-label="내 정보 보기"
          >
            <Avatar
              size="md"
              src={profile.avatarUrl}
              alt={`${profile.name} 프로필 이미지`}
              icon={<UserRound size={26} />}
              className="!h-16 !w-16"
              loading="eager"
            />
          </Link>
          <Link prefetch={false} href="/mypage/account" className="min-w-0">
            <h1 className="truncate text-[16px] font-bold tracking-[-0.01em] text-[var(--fg-strong)]">
              {profile.name}님!
            </h1>
            <p className="mt-1 text-[12px] font-medium leading-5 text-[var(--fg-muted)]">
              내 정보 보기
            </p>
          </Link>
          <Link
            prefetch={false}
            href="/mypage/messages"
            aria-label="대화함"
            className="relative flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--surface-alt)] text-[var(--fg)]"
          >
            <Mail size={24} />
            {hasUnreadMessages ? (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-[var(--radius-pill)] bg-[var(--accent)]" />
            ) : null}
          </Link>
        </div>
        <div className="space-y-8">
          {menuGroups.map((group) => (
            <section key={group.title}>
              <h2 className="mb-3 px-2 text-[16px] font-bold text-[var(--fg-muted)]">
                {group.title}
              </h2>
              <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
                {group.items.map((item) =>
                  "href" in item && item.href ? (
                    <Link
                      prefetch={false}
                      key={item.label}
                      href={item.href}
                      className={myPageMenuItemClass}
                    >
                      <span className="min-w-0 truncate">{item.label}</span>
                      <ChevronRight
                        size={20}
                        className="justify-self-end text-[var(--fg-faint)]"
                      />
                    </Link>
                  ) : (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() =>
                        setConfirmAction(
                          ("action" in item && item.action) || null,
                        )
                      }
                      className={myPageMenuItemClass}
                    >
                      <span className="min-w-0 truncate">{item.label}</span>
                      <ChevronRight
                        size={20}
                        className="justify-self-end text-[var(--fg-faint)]"
                      />
                    </button>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
        <p className="sr-only">{profile.name}</p>
      </section>
      <ConfirmModal
        action={confirmAction}
        onClose={() => setConfirmAction(null)}
      />
    </>
  );
}

function AccountInfoScreen({ snapshot }: { snapshot: MemberSnapshot }) {
  const [confirmAction, setConfirmAction] = useState<"logout" | null>(null);
  const [emailFormOpen, setEmailFormOpen] = useState(!snapshot.account.email);
  const [email, setEmail] = useState(snapshot.account.email ?? "");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneFormOpen, setPhoneFormOpen] = useState(!snapshot.account.phone);
  const [phone, setPhone] = useState(
    snapshot.account.phone ? formatPhoneNumber(snapshot.account.phone) : "",
  );
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneStep, setPhoneStep] = useState<"phone" | "code">("phone");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordFormOpen, setPasswordFormOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const { account } = snapshot;
  const passwordMismatch =
    newPasswordConfirm.length > 0 && newPassword !== newPasswordConfirm;
  const canChangePassword =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPasswordConfirm.length >= 8 &&
    !passwordMismatch;
  const normalizedEmail = normalizeAccountEmail(email);
  const emailValidationMessage = validateAccountEmail(email);
  const canSaveEmail =
    !emailValidationMessage && normalizedEmail !== (account.email ?? "");
  const normalizedPhone = normalizeAccountPhone(phone);
  const phoneValidationMessage = validateAccountPhone(phone);
  const canRequestPhoneCode = !phoneValidationMessage;
  const canSubmitPhoneCode = phoneCode.replace(/\D/g, "").length === 6;

  const submitEmail = async () => {
    if (!canSaveEmail || emailSaving) return;
    setEmailSaving(true);
    setEmailError(null);
    setEmailMessage(null);
    try {
      const result = await updateMemberAccountEmail(normalizedEmail);
      setEmail(result.email);
      setEmailFormOpen(false);
      setEmailMessage("이메일을 등록했습니다.");
      await useMemberStore.getState().load({ force: true });
    } catch (error) {
      setEmailError(
        error instanceof Error ? error.message : "이메일 등록에 실패했습니다.",
      );
    } finally {
      setEmailSaving(false);
    }
  };

  const resetPhoneForm = () => {
    setPhone(account.phone ? formatPhoneNumber(account.phone) : "");
    setPhoneCode("");
    setPhoneStep("phone");
    setPhoneMessage(null);
    setPhoneError(null);
  };

  const submitPhoneCodeRequest = async () => {
    if (!canRequestPhoneCode || phoneSaving) return;
    setPhoneSaving(true);
    setPhoneError(null);
    setPhoneMessage(null);
    try {
      const result = await requestPhoneVerification(normalizedPhone);
      setPhoneStep("code");
      setPhoneCode(result.code ?? "");
      setPhoneMessage("인증번호를 전송했습니다.");
    } catch (error) {
      setPhoneError(
        error instanceof Error
          ? error.message
          : "인증번호 전송에 실패했습니다.",
      );
    } finally {
      setPhoneSaving(false);
    }
  };

  const submitPhoneVerification = async () => {
    if (!canSubmitPhoneCode || phoneSaving) return;
    setPhoneSaving(true);
    setPhoneError(null);
    setPhoneMessage(null);
    try {
      const confirmation = await confirmPhoneVerification(
        normalizedPhone,
        phoneCode.replace(/\D/g, ""),
      );
      const result = await updateMemberAccountPhone({
        phone: normalizedPhone,
        phoneVerificationToken: confirmation.verificationToken,
      });
      setPhone(formatPhoneNumber(result.phone));
      setPhoneCode("");
      setPhoneStep("phone");
      setPhoneFormOpen(false);
      setPhoneMessage("휴대폰 번호 인증이 완료됐습니다.");
      await useMemberStore.getState().load({ force: true });
    } catch (error) {
      setPhoneError(
        error instanceof Error
          ? error.message
          : "휴대폰 번호 인증에 실패했습니다.",
      );
    } finally {
      setPhoneSaving(false);
    }
  };

  const submitPasswordChange = async () => {
    if (!canChangePassword || passwordSaving) return;
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordMessage(null);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setPasswordFormOpen(false);
      setPasswordMessage("비밀번호를 변경했습니다.");
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "비밀번호 변경에 실패했습니다.",
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="member-slide-page min-h-screen bg-[var(--bg)]">
      <MyPageSubHeader title="내 정보 수정" />
      <main className="py-5">
        <AccountSection title="정보">
          <AccountButtonRow
            label="이메일"
            value={account.email ?? "등록 필요"}
            valueClassName={
              account.email ? "text-[var(--fg-muted)]" : "text-[var(--warn)]"
            }
            onClick={() => {
              setEmailFormOpen((current) => !current);
              setEmail(account.email ?? "");
              setEmailMessage(null);
              setEmailError(null);
            }}
            expanded={emailFormOpen}
          />
          {emailFormOpen ? (
            <EmailRegistrationForm
              email={email}
              saving={emailSaving}
              canSubmit={canSaveEmail}
              validationMessage={email ? emailValidationMessage : null}
              error={emailError}
              onEmailChange={(value) => {
                setEmail(value);
                setEmailMessage(null);
                setEmailError(null);
              }}
              onSubmit={submitEmail}
            />
          ) : null}
          {emailMessage ? (
            <p className="px-4 py-3 text-[13px] font-medium text-[var(--success)]">
              {emailMessage}
            </p>
          ) : null}
          {account.phone ? (
            <AccountReadOnlyRow
              label="휴대폰 번호"
              value={formatAccountPhone(account.phone)}
            />
          ) : (
            <>
              <AccountButtonRow
                label="휴대폰 번호"
                value="등록 필요"
                valueClassName="text-[var(--warn)]"
                onClick={() => {
                  setPhoneFormOpen((current) => !current);
                  resetPhoneForm();
                }}
                expanded={phoneFormOpen}
              />
              {phoneFormOpen ? (
                <PhoneVerificationForm
                  phone={phone}
                  code={phoneCode}
                  step={phoneStep}
                  saving={phoneSaving}
                  canRequestCode={canRequestPhoneCode}
                  canSubmitCode={canSubmitPhoneCode}
                  validationMessage={phone ? phoneValidationMessage : null}
                  message={phoneMessage}
                  error={phoneError}
                  onPhoneChange={(value) => {
                    setPhone(formatPhoneNumber(value));
                    setPhoneCode("");
                    setPhoneStep("phone");
                    setPhoneMessage(null);
                    setPhoneError(null);
                  }}
                  onCodeChange={(value) => {
                    setPhoneCode(value.replace(/\D/g, "").slice(0, 6));
                    setPhoneMessage(null);
                    setPhoneError(null);
                  }}
                  onRequestCode={submitPhoneCodeRequest}
                  onSubmitCode={submitPhoneVerification}
                />
              ) : null}
              {!phoneFormOpen && phoneMessage ? (
                <p className="px-4 py-3 text-[13px] font-medium text-[var(--success)]">
                  {phoneMessage}
                </p>
              ) : null}
            </>
          )}
          <AccountReadOnlyRow label="국가" value={account.country} />
        </AccountSection>

        <AccountSection title="보안">
          {account.identityVerified ? (
            <AccountReadOnlyRow
              label="본인인증"
              value="인증됨"
              valueClassName="text-[var(--fg-muted)]"
            />
          ) : (
            <AccountButtonRow
              label="본인인증"
              value="인증 필요"
              valueClassName="text-[var(--warn)]"
              onClick={() => {
                setPhoneFormOpen(true);
                setPhoneMessage("휴대폰 번호 인증으로 본인인증을 완료합니다.");
                setPhoneError(null);
              }}
              expanded={phoneFormOpen}
            />
          )}
        </AccountSection>

        <AccountSection title="기타">
          <AccountButtonRow
            label="비밀번호 변경"
            onClick={() => {
              setPasswordFormOpen((current) => !current);
              setPasswordMessage(null);
              setPasswordError(null);
            }}
            expanded={passwordFormOpen}
          />
          {passwordFormOpen ? (
            <PasswordChangeForm
              currentPassword={currentPassword}
              newPassword={newPassword}
              newPasswordConfirm={newPasswordConfirm}
              saving={passwordSaving}
              passwordMismatch={passwordMismatch}
              canSubmit={canChangePassword}
              error={passwordError}
              onCurrentPasswordChange={setCurrentPassword}
              onNewPasswordChange={setNewPassword}
              onNewPasswordConfirmChange={setNewPasswordConfirm}
              onSubmit={submitPasswordChange}
            />
          ) : null}
          {passwordMessage ? (
            <p className="px-4 py-3 text-[13px] font-medium text-[var(--success)]">
              {passwordMessage}
            </p>
          ) : null}
          <AccountLinkRow label="탈퇴하기" href="/mypage/withdraw" />
        </AccountSection>
      </main>
      <ConfirmModal
        action={confirmAction}
        onClose={() => setConfirmAction(null)}
      />
    </div>
  );
}

function AccountSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-[var(--border)] py-5">
      <h2 className="px-4 text-[14px] font-bold text-[var(--fg-muted)]">
        {title}
      </h2>
      <div className="mt-4 divide-y divide-[var(--border)]">{children}</div>
    </section>
  );
}

function AccountLinkRow({
  label,
  value,
  href,
  valueClassName,
}: {
  label: string;
  value?: string;
  href: string;
  valueClassName?: string;
}) {
  return (
    <Link
      prefetch={false}
      href={href}
      className="grid h-16 grid-cols-[minmax(92px,1fr)_minmax(0,1.25fr)_24px] items-center gap-2 px-4"
    >
      <span className="text-[17px] font-medium text-[var(--fg)]">{label}</span>
      {value ? (
        <span
          className={cn(
            "min-w-0 truncate text-right text-[16px] font-medium",
            valueClassName ?? "text-[var(--fg-muted)]",
          )}
        >
          {value}
        </span>
      ) : (
        <span />
      )}
      <ChevronRight
        size={22}
        className="justify-self-end text-[var(--fg-faint)]"
      />
    </Link>
  );
}

function AccountReadOnlyRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value?: string;
  valueClassName?: string;
}) {
  return (
    <div className="grid h-16 grid-cols-[minmax(92px,1fr)_minmax(0,1.25fr)] items-center gap-2 px-4">
      <span className="text-[17px] font-medium text-[var(--fg)]">{label}</span>
      {value ? (
        <span
          className={cn(
            "min-w-0 truncate text-right text-[16px] font-medium",
            valueClassName ?? "text-[var(--fg-muted)]",
          )}
        >
          {value}
        </span>
      ) : (
        <span />
      )}
    </div>
  );
}

function AccountButtonRow({
  label,
  value,
  valueClassName,
  onClick,
  expanded,
}: {
  label: string;
  value?: string;
  valueClassName?: string;
  onClick: () => void;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-16 w-full grid-cols-[minmax(92px,1fr)_minmax(0,1.25fr)_24px] items-center gap-2 px-4 text-left"
    >
      <span className="text-[17px] font-medium text-[var(--fg)]">{label}</span>
      {value ? (
        <span
          className={cn(
            "min-w-0 truncate text-right text-[16px] font-medium",
            valueClassName ?? "text-[var(--fg-muted)]",
          )}
        >
          {value}
        </span>
      ) : (
        <span />
      )}
      {expanded ? (
        <ChevronUp
          size={22}
          className="justify-self-end text-[var(--fg-faint)]"
        />
      ) : (
        <ChevronRight
          size={22}
          className="justify-self-end text-[var(--fg-faint)]"
        />
      )}
    </button>
  );
}

function EmailRegistrationForm({
  email,
  saving,
  canSubmit,
  validationMessage,
  error,
  onEmailChange,
  onSubmit,
}: {
  email: string;
  saving: boolean;
  canSubmit: boolean;
  validationMessage: string | null;
  error: string | null;
  onEmailChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-3 bg-[var(--surface-alt)] px-4 py-4">
      <label className="block">
        <span className="text-[13px] font-bold text-[var(--fg-muted)]">
          이메일
        </span>
        <input
          type="email"
          value={email}
          autoComplete="email"
          inputMode="email"
          placeholder="email@example.com"
          onChange={(event) => onEmailChange(event.target.value)}
          className="mt-2 h-12 w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-[16px] outline-none placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent)]"
        />
      </label>
      {validationMessage ? (
        <p className="text-[13px] font-medium text-[var(--danger)]">
          {validationMessage}
        </p>
      ) : null}
      {error ? (
        <p className="text-[13px] font-medium text-[var(--danger)]">{error}</p>
      ) : null}
      <button
        type="button"
        disabled={!canSubmit || saving}
        onClick={onSubmit}
        className="mt-1 flex h-12 w-full items-center justify-center rounded-[var(--radius-lg)] bg-[var(--accent)] text-[16px] font-bold text-white disabled:opacity-40"
      >
        {saving ? "등록 중" : "이메일 등록"}
      </button>
    </div>
  );
}

function PhoneVerificationForm({
  phone,
  code,
  step,
  saving,
  canRequestCode,
  canSubmitCode,
  validationMessage,
  message,
  error,
  onPhoneChange,
  onCodeChange,
  onRequestCode,
  onSubmitCode,
}: {
  phone: string;
  code: string;
  step: "phone" | "code";
  saving: boolean;
  canRequestCode: boolean;
  canSubmitCode: boolean;
  validationMessage: string | null;
  message: string | null;
  error: string | null;
  onPhoneChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onRequestCode: () => void;
  onSubmitCode: () => void;
}) {
  return (
    <div className="space-y-3 bg-[var(--surface-alt)] px-4 py-4">
      <label className="block">
        <span className="text-[13px] font-bold text-[var(--fg-muted)]">
          휴대폰 번호
        </span>
        <input
          type="tel"
          value={phone}
          autoComplete="tel"
          inputMode="tel"
          placeholder="010-0000-0000"
          onChange={(event) => onPhoneChange(event.target.value)}
          className="mt-2 h-12 w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-[16px] outline-none placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent)]"
        />
      </label>
      {step === "code" ? (
        <label className="block">
          <span className="text-[13px] font-bold text-[var(--fg-muted)]">
            인증번호
          </span>
          <input
            type="text"
            value={code}
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            placeholder="6자리 입력"
            onChange={(event) => onCodeChange(event.target.value)}
            className="mt-2 h-12 w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-[16px] outline-none placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent)]"
          />
        </label>
      ) : null}
      {validationMessage ? (
        <p className="text-[13px] font-medium text-[var(--danger)]">
          {validationMessage}
        </p>
      ) : null}
      {message ? (
        <p className="text-[13px] font-medium text-[var(--success)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-[13px] font-medium text-[var(--danger)]">{error}</p>
      ) : null}
      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          disabled={!canRequestCode || saving}
          onClick={onRequestCode}
          className="flex h-12 w-full items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] text-[16px] font-bold text-[var(--fg)] disabled:opacity-40"
        >
          {saving && step === "phone" ? "전송 중" : "인증번호 전송"}
        </button>
        {step === "code" ? (
          <button
            type="button"
            disabled={!canSubmitCode || saving}
            onClick={onSubmitCode}
            className="flex h-12 w-full items-center justify-center rounded-[var(--radius-lg)] bg-[var(--accent)] text-[16px] font-bold text-white disabled:opacity-40"
          >
            {saving ? "인증 중" : "인증 완료"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PasswordChangeForm({
  currentPassword,
  newPassword,
  newPasswordConfirm,
  saving,
  passwordMismatch,
  canSubmit,
  error,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onNewPasswordConfirmChange,
  onSubmit,
}: {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirm: string;
  saving: boolean;
  passwordMismatch: boolean;
  canSubmit: boolean;
  error: string | null;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onNewPasswordConfirmChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-3 bg-[var(--surface-alt)] px-4 py-4">
      <AccountPasswordInput
        label="현재 비밀번호"
        value={currentPassword}
        autoComplete="current-password"
        onChange={onCurrentPasswordChange}
      />
      <AccountPasswordInput
        label="새 비밀번호"
        value={newPassword}
        autoComplete="new-password"
        onChange={onNewPasswordChange}
      />
      <AccountPasswordInput
        label="새 비밀번호 확인"
        value={newPasswordConfirm}
        autoComplete="new-password"
        onChange={onNewPasswordConfirmChange}
      />
      {passwordMismatch ? (
        <p className="text-[13px] font-medium text-[var(--danger)]">
          새 비밀번호가 일치하지 않습니다.
        </p>
      ) : null}
      {error ? (
        <p className="text-[13px] font-medium text-[var(--danger)]">{error}</p>
      ) : null}
      <button
        type="button"
        disabled={!canSubmit || saving}
        onClick={onSubmit}
        className="mt-1 flex h-12 w-full items-center justify-center rounded-[var(--radius-lg)] bg-[var(--accent)] text-[16px] font-bold text-white disabled:opacity-40"
      >
        {saving ? "변경 중" : "비밀번호 변경"}
      </button>
    </div>
  );
}

function AccountPasswordInput({
  label,
  value,
  autoComplete,
  onChange,
}: {
  label: string;
  value: string;
  autoComplete: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-bold text-[var(--fg-muted)]">
        {label}
      </span>
      <input
        type="password"
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-[16px] outline-none focus:border-[var(--accent)]"
      />
    </label>
  );
}

function VersionInfoBody() {
  return (
    <section className="px-4 py-5">
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
        <div className="grid h-16 grid-cols-[1fr_auto] items-center px-4">
          <span className="text-[16px] font-medium text-[var(--fg)]">
            BLENDING
          </span>
          <span className="text-[12px] font-medium text-[var(--fg-muted)]">
            v0.1.0
          </span>
        </div>
      </div>
    </section>
  );
}

function formatAccountPhone(phone?: string) {
  if (!phone) return "등록 필요";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("010") && digits.length === 11) {
    return `+82 10-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

type MyPageSubKind =
  | "notifications"
  | "search"
  | "messages"
  | "my-posts"
  | "interests"
  | "favorite-baristas"
  | "notices"
  | "faq"
  | "notification-settings"
  | "version"
  | "recipes";

function MyPageSubScreen({
  title,
  kind,
  snapshot,
}: {
  title: string;
  kind: MyPageSubKind;
  snapshot: MemberSnapshot;
}) {
  if (kind === "messages") {
    return (
      <MessageScreenBody
        messages={snapshot.messages}
        chatRoomSettings={snapshot.chatRoomSettings}
        myProfileId={snapshot.profile.id}
        variant="mypage"
      />
    );
  }

  return (
    <div className="member-slide-page min-h-screen w-full overflow-x-hidden bg-[var(--bg)]">
      <MyPageSubHeader title={title} />
      {kind === "notifications" ? (
        <NotificationsScreenBody
          notifications={snapshot.notifications}
          messages={snapshot.messages}
          messageBasePath="/mypage/messages"
        />
      ) : null}
      {kind === "search" ? <SearchScreenBody /> : null}
      {kind === "my-posts" ? (
        <MyActivityScreenBody
          activities={snapshot.myActivities}
          authorName={snapshot.profile.name}
        />
      ) : null}
      {kind === "interests" ? (
        <InterestScreenBody interests={snapshot.interests} />
      ) : null}
      {kind === "favorite-baristas" ? (
        <FavoritesScreenBody
          favorites={snapshot.favorites}
          favoriteFollowers={snapshot.favoriteFollowers}
        />
      ) : null}
      {kind === "notices" ? <NoticeScreenBody /> : null}
      {kind === "faq" ? <FaqScreenBody /> : null}
      {kind === "notification-settings" ? (
        <NotificationSettingsBody settings={snapshot.notificationSettings} />
      ) : null}
      {kind === "version" ? <VersionInfoBody /> : null}
      {kind === "recipes" ? (
        <MyRecipesScreenBody recipes={snapshot.recipes} />
      ) : null}
    </div>
  );
}

function MyPageSubHeader({ title }: { title: string }) {
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 mx-auto max-w-[var(--app-shell-max-width)] border-b border-[var(--border)] bg-[var(--surface)]/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="grid h-16 grid-cols-[56px_1fr_56px] items-center px-2">
          <Link
            prefetch={false}
            href="/mypage"
            aria-label="마이페이지로 돌아가기"
            className="flex h-11 w-11 items-center justify-center text-[var(--fg)]"
          >
            <ArrowLeft size={25} strokeWidth={2.2} />
          </Link>
          <h1 className="text-center text-[18px] font-bold tracking-[-0.01em] text-[var(--fg-strong)]">
            {title}
          </h1>
          <div />
        </div>
      </header>
      <div
        aria-hidden="true"
        className="h-[calc(64px+env(safe-area-inset-top))]"
      />
    </>
  );
}

function HomeSubHeader({ title, right }: { title: string; right?: ReactNode }) {
  const router = useRouter();

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 mx-auto max-w-[var(--app-shell-max-width)] border-b border-[var(--border)] bg-[var(--surface)]/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="grid h-16 grid-cols-[56px_1fr_56px] items-center px-2">
          <button
            type="button"
            aria-label="뒤로가기"
            onClick={() => {
              if (window.history.length > 1) router.back();
              else router.push("/home");
            }}
            className="flex h-11 w-11 items-center justify-center text-[var(--fg)]"
          >
            <ArrowLeft size={25} strokeWidth={2.2} />
          </button>
          <h1 className="min-w-0 truncate text-center text-[20px] font-bold tracking-[-0.01em] text-[var(--fg-strong)]">
            {title}
          </h1>
          <div className="flex h-11 w-11 items-center justify-center">
            {right}
          </div>
        </div>
      </header>
      <div
        aria-hidden="true"
        className="h-[calc(64px+env(safe-area-inset-top))]"
      />
    </>
  );
}

function MyActivityScreenBody({
  activities,
  authorName,
}: {
  activities: MyActivityItem[];
  authorName: string;
}) {
  const [filter, setFilter] = useState<"post" | "comment">("post");
  const posts = activities.filter((activity) => activity.kind === "post");
  const comments = activities.filter((activity) => activity.kind === "comment");
  const visibleActivities = filter === "post" ? posts : comments;
  const filters = [
    {
      value: "post" as const,
      label: "게시글",
      count: posts.length,
    },
    {
      value: "comment" as const,
      label: "댓글",
      count: comments.length,
    },
  ];

  if (activities.length === 0) {
    return (
      <EmptyMyPageBody
        title="등록된 내역이 없습니다"
        description="작성한 글이나 댓글이 생기면 이곳에 모입니다."
      />
    );
  }

  return (
    <section>
      <TextTabBar
        ariaLabel="내가 쓴 글과 댓글 탭"
        items={filters}
        activeValue={filter}
        onChange={setFilter}
      />

      {visibleActivities.length === 0 ? (
        <EmptyMyPageBody title="등록된 내역이 없습니다" compact />
      ) : (
        <div className="divide-y divide-[var(--border-strong)] px-6 pb-8 pt-2">
          {visibleActivities.map((activity) => (
            <MyActivityRow
              key={activity.id}
              activity={activity}
              authorName={authorName}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MyActivityRow({
  activity,
  authorName,
}: {
  activity: MyActivityItem;
  authorName: string;
}) {
  const hasThumbnail = Boolean(activity.imageUrl);

  return (
    <article className="py-2">
      <div
        className={cn(
          "grid items-center gap-x-4",
          hasThumbnail ? "grid-cols-[minmax(0,1fr)_64px]" : "grid-cols-1",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-col justify-center gap-1",
            hasThumbnail && "min-h-[64px]",
          )}
        >
          <Link prefetch={false} href={activity.href} className="min-w-0">
            <h2 className="line-clamp-2 text-[16px] font-bold leading-[1.35] tracking-[-0.01em] text-[var(--fg-strong)]">
              {activity.title}
            </h2>
          </Link>
          <CompactPostMeta
            href={activity.href}
            authorName={authorName}
            dateLabel={formatRelativeTime(activity.createdAt)}
            viewCount={activity.viewCount}
            commentCount={activity.commentCount}
            likeCount={activity.likeCount}
          />
        </div>
        {hasThumbnail ? (
          <Link
            prefetch={false}
            href={activity.href}
            className="block h-[64px] w-[64px] overflow-hidden rounded-[var(--radius-sm)] bg-[var(--surface-alt)]"
          >
            <ImageBox
              src={activity.imageUrl}
              alt={activity.title}
              className="h-full w-full"
            />
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function CompactPostMeta({
  href,
  authorName,
  dateLabel,
  viewCount,
  commentCount,
  likeCount,
}: {
  href: string;
  authorName: string;
  dateLabel: string;
  viewCount?: number;
  commentCount?: number;
  likeCount?: number;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Link
        prefetch={false}
        href={href}
        className="truncate text-[12px] leading-none text-[var(--fg-muted)]"
      >
        {authorName}
      </Link>
      <div className="flex min-w-0 items-center gap-1 overflow-hidden">
        <span className="shrink-0 text-[12px] leading-none text-[var(--fg-muted)]">
          {dateLabel}
        </span>
        <InterestViewCount count={viewCount} />
        <InterestMetricGroup>
          <span className="grid h-4 grid-cols-[14px_auto] items-center gap-0.5 whitespace-nowrap leading-none">
            <MessageSquare size={14} strokeWidth={1.75} className="shrink-0" />
            <span className="text-[12px] leading-none tabular-nums text-[var(--fg-muted)]">
              {formatMemberMetaCount(commentCount ?? 0)}
            </span>
          </span>
          <span
            aria-label={`좋아요 ${formatMemberMetaCount(likeCount ?? 0)}`}
            className="grid h-4 grid-cols-[14px_auto] items-center gap-0.5 whitespace-nowrap leading-none text-[var(--fg-subtle)]"
          >
            <Heart
              size={14}
              strokeWidth={1.75}
              className="shrink-0"
              aria-hidden
            />
            <span className="text-[12px] leading-none tabular-nums text-[var(--fg-muted)]">
              {formatMemberMetaCount(likeCount ?? 0)}
            </span>
          </span>
        </InterestMetricGroup>
      </div>
    </div>
  );
}

function formatMemberMetaCount(value: number) {
  return value >= 1000
    ? `${Number((value / 1000).toFixed(1))}k`
    : String(value);
}

function NotificationsScreenBody({
  notifications,
  messages,
  messageBasePath,
}: {
  notifications: NotificationItem[];
  messages: DirectMessage[];
  messageBasePath: "/home/messages" | "/mypage/messages";
}) {
  const router = useRouter();
  const removeNotification = useMemberStore(
    (state) => state.removeNotification,
  );
  const markAllNotificationsRead = useMemberStore(
    (state) => state.markAllNotificationsRead,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [error, setError] = useState("");
  const notificationItems = useMemo(
    () => buildNotificationListItems(notifications, messages),
    [messages, notifications],
  );
  const hasUnreadNotifications = notifications.some(
    (notification) => notification.unread,
  );

  const markAllRead = async () => {
    if (!hasUnreadNotifications || deletingId || isMarkingAllRead) return;

    setIsMarkingAllRead(true);
    setError("");

    try {
      await markMemberNotificationsRead();
      markAllNotificationsRead();
    } catch (readError) {
      setError(
        readError instanceof Error
          ? readError.message
          : "알림 읽음 처리에 실패했습니다.",
      );
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  if (notificationItems.length === 0) {
    return (
      <section className="flex min-h-[calc(100vh-64px)] flex-col px-6 py-4">
        <EmptyMyPageBody
          title="새 알림이 없습니다"
          description="댓글, 좋아요, 대화, 공지 알림이 생기면 이곳에 표시됩니다."
          compact
        />
        <p className="mt-auto pb-10 text-center text-[12px] leading-6 text-[var(--fg-muted)]">
          30일이 지난 알림은 자동 삭제됩니다.
        </p>
      </section>
    );
  }

  return (
    <section className="flex min-h-[calc(100vh-64px)] flex-col px-4 py-4">
      <div className="mb-3 flex min-h-9 items-center justify-end">
        {hasUnreadNotifications ? (
          <button
            type="button"
            onClick={markAllRead}
            disabled={deletingId !== null || isMarkingAllRead}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 font-[var(--font-body)] text-[13px] font-medium leading-none text-[var(--fg-strong)] transition-opacity disabled:opacity-50"
          >
            <Check size={15} strokeWidth={2.2} />
            전체 읽음
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="mb-3 text-[13px] leading-5 text-[var(--accent)]">
          {error}
        </p>
      ) : null}
      <div className="space-y-2">
        {notificationItems.map((notification) => {
          const item = notification.item;
          return (
            <button
              key={item.id}
              type="button"
              disabled={deletingId !== null}
              onClick={async () => {
                if (deletingId || isMarkingAllRead) return;
                setDeletingId(item.id);
                setError("");
                try {
                  await Promise.allSettled(
                    notification.notificationIds.map((notificationId) =>
                      deleteMemberNotification(notificationId),
                    ),
                  );
                  notification.notificationIds.forEach((notificationId) =>
                    removeNotification(notificationId),
                  );
                  const href = notificationHref(item, { messageBasePath });
                  if (href) router.push(href);
                } catch (deleteError) {
                  setError(
                    deleteError instanceof Error
                      ? deleteError.message
                      : "알림 삭제에 실패했습니다.",
                  );
                } finally {
                  setDeletingId(null);
                }
              }}
              className={cn(
                "grid w-full grid-cols-[48px_minmax(0,1fr)] items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--border-strong)] p-4 text-left transition-opacity",
                notification.unreadCount > 0 &&
                  "border-transparent bg-[var(--surface-alt)]",
                deletingId === item.id && "opacity-60",
              )}
            >
              <NotificationIcon
                item={item}
                avatarUrl={notification.avatarUrl}
              />
              <div className="min-w-0">
                <h2
                  className={cn(
                    "break-words text-[16px] leading-[1.35] text-[var(--fg-strong)]",
                    notification.unreadCount > 0 ? "font-bold" : "font-medium",
                  )}
                >
                  {notification.title}
                </h2>
                <p className="mt-1 truncate text-[14px] leading-6 text-[var(--fg)]">
                  {notification.preview ?? notification.createdAgo}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-[12px] leading-[1.5] text-[var(--fg-muted)]">
                    {notification.createdAgo}
                  </p>
                  {notification.unreadCount > 1 ? (
                    <span className="rounded-[var(--radius-pill)] bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold leading-5 text-white">
                      {notification.unreadCount}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-auto pb-10 text-center text-[12px] leading-6 text-[var(--fg-muted)]">
        30일이 지난 알림은 자동 삭제됩니다.
      </p>
    </section>
  );
}

function FavoritesScreenBody({
  favorites,
  favoriteFollowers,
}: {
  favorites: FavoriteProfile[];
  favoriteFollowers: FavoriteProfile[];
}) {
  const toggleFavorite = useMemberStore((state) => state.toggleFavorite);
  const favoriteStates = useMemberStore((state) => state.favoriteStates);
  const [activeTab, setActiveTab] = useState<"mine" | "followers">("mine");
  const [savingFavoriteId, setSavingFavoriteId] = useState<string | null>(null);
  const visibleFavorites =
    activeTab === "mine"
      ? favorites.filter(
          (favorite) => favoriteStates[favorite.id] ?? favorite.favorited,
        )
      : favoriteFollowers;

  const handleFavoriteToggle = async (favorite: FavoriteProfile) => {
    if (savingFavoriteId) return;

    const currentFavorited = favoriteStates[favorite.id] ?? favorite.favorited;
    const nextFavorited = !currentFavorited;
    toggleFavorite(favorite.id, favorite.favorited);
    setSavingFavoriteId(favorite.id);

    try {
      await updateFavoriteProfile(favorite.id, nextFavorited);
      void useMemberStore.getState().load({ force: true });
    } catch {
      toggleFavorite(favorite.id, favorite.favorited);
      window.alert("즐겨찾기를 저장하지 못했습니다.");
    } finally {
      setSavingFavoriteId(null);
    }
  };

  if (favorites.length === 0 && favoriteFollowers.length === 0) {
    return (
      <EmptyMyPageBody
        title="등록된 내역이 없습니다"
        description="즐겨찾기 내역이 생기면 이곳에 표시됩니다."
      />
    );
  }

  return (
    <>
      <TextTabBar
        ariaLabel="즐겨찾기 탭"
        activeValue={activeTab}
        onChange={setActiveTab}
        items={[
          { value: "mine" as const, label: "내가 즐겨찾기 한" },
          { value: "followers" as const, label: "나를 즐겨찾기 한" },
        ]}
      />
      <section className="px-6 py-8">
        <label className="mb-8 flex h-14 items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-strong)] px-4">
          <Search size={20} className="text-[var(--fg-subtle)]" />
          <input
            name="mypageFavoriteSearch"
            aria-label="즐겨찾기 이름 검색"
            className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[var(--fg-subtle)]"
            placeholder="이름 검색"
          />
        </label>
        {visibleFavorites.length === 0 ? (
          <EmptyMyPageBody
            title="등록된 내역이 없습니다"
            description={
              activeTab === "mine"
                ? "즐겨찾기 한 바리스타가 생기면 이곳에 표시됩니다."
                : "나를 즐겨찾기 한 바리스타가 생기면 이곳에 표시됩니다."
            }
            compact
          />
        ) : (
          <div className="divide-y divide-[var(--border-strong)]">
            {visibleFavorites.map((favorite) => {
              const favorited =
                favoriteStates[favorite.id] ?? favorite.favorited;
              return (
                <article
                  key={favorite.id}
                  className="grid grid-cols-[64px_minmax(0,1fr)_52px] items-center gap-4 py-4"
                >
                  <Link
                    prefetch={false}
                    href={`/profile/${favorite.id}`}
                    aria-label={`${favorite.name} 프로필 보기`}
                    className="col-span-2 grid min-w-0 grid-cols-[64px_minmax(0,1fr)] items-center gap-4"
                  >
                    <Avatar
                      size="md"
                      src={favorite.avatarUrl}
                      alt={favorite.name}
                      className="!h-[64px] !w-[64px]"
                    />
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h2 className="min-w-0 text-[16px] font-bold leading-[1.35] text-[var(--fg-strong)]">
                          {favorite.name}
                        </h2>
                        {favorite.role ? (
                          <span className="rounded-[var(--radius-sm)] bg-[var(--fg)] px-2 py-0.5 text-[12px] font-bold leading-[1.4] text-[var(--surface)]">
                            {roleLabel(favorite.role)}
                          </span>
                        ) : null}
                      </div>
                      {favorite.specialties.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {favorite.specialties.map((specialty) => (
                            <Chip key={specialty}>{specialty}</Chip>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-2 line-clamp-1 text-[12px] leading-[1.5] text-[var(--fg-muted)]">
                        {favorite.bio}
                      </p>
                    </div>
                  </Link>
                  <button
                    type="button"
                    aria-label={favorited ? "즐겨찾기 해제" : "즐겨찾기"}
                    aria-pressed={favorited}
                    disabled={savingFavoriteId === favorite.id}
                    onClick={() => void handleFavoriteToggle(favorite)}
                    className={cn(
                      "flex h-11 w-[52px] items-center justify-center justify-self-end self-end pb-1 transition-colors",
                      favorited
                        ? "text-[var(--accent)]"
                        : "text-[var(--fg-subtle)]",
                    )}
                  >
                    <FavoriteStarIcon filled={favorited} size={20} />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

function MyRecipesScreenBody({ recipes }: { recipes: MyRecipe[] }) {
  const recipeLikes = useMemberStore((state) => state.recipeLikes);
  const toggleRecipeLike = useMemberStore((state) => state.toggleRecipeLike);

  if (recipes.length === 0) {
    return (
      <EmptyMyPageBody
        title="등록된 내역이 없습니다"
        description="등록한 레시피가 생기면 이곳에 표시됩니다."
      />
    );
  }

  return (
    <section className="space-y-6 px-6 py-8">
      {recipes.map((recipe) => {
        const liked = recipeLikes[recipe.id] ?? recipe.liked;
        return (
          <article
            key={recipe.id}
            className="grid grid-cols-[136px_1fr_36px] gap-5 rounded-[var(--radius-lg)] border border-[var(--border-strong)] p-5"
          >
            <Link prefetch={false} href={myRecipeHref(recipe)}>
              <ImageBox
                src={recipe.imageUrl}
                alt={recipe.title}
                className="aspect-square"
              />
            </Link>
            <Link
              prefetch={false}
              href={myRecipeHref(recipe)}
              className="min-w-0"
            >
              <h2 className="line-clamp-2 text-[16px] font-bold leading-[1.35] text-[var(--fg-strong)]">
                {recipe.title}
              </h2>
              <p className="mt-2 line-clamp-2 text-[12px] leading-6 text-[var(--fg-muted)]">
                {recipe.summary}
              </p>
              <p className="mt-3 text-[12px] leading-[1.5] text-[var(--fg-muted)]">
                {recipe.createdAt}
              </p>
            </Link>
            <button
              type="button"
              aria-label="레시피 좋아요"
              onClick={() => toggleRecipeLike(recipe.id, recipe.liked)}
              className={cn(
                "self-end text-[var(--fg-muted)]",
                liked && "text-[var(--accent)]",
              )}
            >
              <Heart size={23} fill={liked ? "currentColor" : "none"} />
            </button>
          </article>
        );
      })}
    </section>
  );
}

type SearchScope = "all" | "community" | "partner" | "member" | "barista";

const searchScopes: Array<{
  key: SearchScope;
  label: string;
  types?: SearchDocumentType[];
}> = [
  { key: "all", label: "전체" },
  {
    key: "community",
    label: "커뮤니티",
    types: [
      "community_event",
      "community_review",
      "community_b_talk",
      "community_qa",
    ],
  },
  {
    key: "partner",
    label: "파트너",
    types: ["partner_promotion", "partner_review"],
  },
  { key: "barista", label: "바리스타", types: ["member_profile"] },
  { key: "member", label: "프로필", types: ["member_profile"] },
];

function SearchScreenBody() {
  const searchParams = useSearchParams();
  const initialScope = searchScopes.some(
    (item) => item.key === searchParams.get("scope"),
  )
    ? (searchParams.get("scope") as SearchScope)
    : "all";
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>(initialScope);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedUserVersion, setBlockedUserVersion] = useState(0);
  const normalizedQuery = query.trim();
  const activeScope = searchScopes.find((item) => item.key === scope);

  useEffect(
    () =>
      listenForBlockedUser(() => setBlockedUserVersion((value) => value + 1)),
    [],
  );

  useEffect(() => {
    if (normalizedQuery.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      setError(null);

      fetchSearchResults({
        query: normalizedQuery,
        types: activeScope?.types,
        signal: controller.signal,
      })
        .then((data) => {
          setResults(data.results);
          setSearching(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setResults([]);
          setSearching(false);
          setError("검색 결과를 불러오지 못했습니다.");
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeScope?.types, blockedUserVersion, normalizedQuery]);

  return (
    <section className="px-6 py-8">
      <label className="flex h-14 items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--border-strong)] px-5">
        <Search size={22} className="text-[var(--fg-subtle)]" />
        <input
          name="mypageSearch"
          aria-label="검색어"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[var(--fg-subtle)]"
          placeholder="무엇을 찾고 있나요?"
        />
      </label>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {searchScopes.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setScope(item.key)}
            className={cn(
              "shrink-0 rounded-[var(--radius-pill)] px-4 py-2 text-[13px] font-medium text-[var(--fg-muted)]",
              item.key === scope &&
                "bg-[var(--fg)] font-bold text-[var(--surface)]",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {normalizedQuery.length === 0 ? (
        <EmptyMyPageBody
          title="검색어를 입력하세요"
          description="커뮤니티, 파트너, 프로필을 한 번에 찾을 수 있습니다."
          compact
        />
      ) : normalizedQuery.length < 2 ? (
        <EmptyMyPageBody
          title="2글자 이상 입력해 주세요"
          description="조금 더 구체적인 키워드로 검색하면 결과가 좋아집니다."
          compact
        />
      ) : searching ? (
        <EmptyMyPageBody title="검색 중입니다." compact />
      ) : error ? (
        <EmptyMyPageBody
          title={error}
          description="잠시 후 다시 시도해 주세요."
          compact
        />
      ) : results.length === 0 ? (
        <EmptyMyPageBody
          title="검색 결과가 없습니다"
          description="다른 키워드로 다시 검색해보세요."
          compact
        />
      ) : (
        <div className="mt-6 divide-y divide-[var(--border-strong)]">
          {results.map((item) => (
            <Link
              prefetch={false}
              key={item.id}
              href={item.href}
              className="grid grid-cols-[56px_minmax(0,1fr)] gap-4 py-5"
            >
              <div className="h-14 w-14 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--surface-alt)]">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt=""
                    width={56}
                    height={56}
                    sizes="56px"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[var(--fg-subtle)]">
                    <Search size={20} />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Chip>{item.label}</Chip>
                </div>
                <h2 className="mt-2 line-clamp-1 text-[18px] font-bold text-[var(--fg-strong)]">
                  {item.title}
                </h2>
                <p className="mt-2 line-clamp-2 text-[14px] leading-6 text-[var(--fg-muted)]">
                  {item.excerpt}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function MessageScreenBody({
  messages,
  chatRoomSettings,
  myProfileId,
  variant = "home",
}: {
  messages: DirectMessage[];
  chatRoomSettings: DirectChatRoomSetting[];
  myProfileId: string;
  variant?: "home" | "mypage";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedThreadId = searchParams.get("thread");
  const requestedThreadName = searchParams.get("recipientName");
  const requestedThreadWorkplace = searchParams.get("recipientWorkplace");
  const requestedThreadAvatarUrl = searchParams.get("recipientAvatarUrl");
  type Conversation = {
    counterpartId: string;
    counterpartName: string;
    counterpartWorkplace?: string;
    counterpartAvatarUrl?: string;
    latestMessage: DirectMessage | null;
    messages: DirectMessage[];
    unreadCount: number;
  };

  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const markedReadThreadRef = useRef<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatImageInputRef = useRef<HTMLInputElement | null>(null);
  const chatImagesRef = useRef<AttachedImage[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [chatImages, setChatImages] = useState<AttachedImage[]>([]);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replyToast, setReplyToast] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<ChatActionSheetKind>(null);
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(
    null,
  );
  const [reportMessage, setReportMessage] = useState<DirectMessage | null>(
    null,
  );
  const messageReportTriggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const [savingChatSetting, setSavingChatSetting] = useState(false);
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);
  const isMyPage = variant === "mypage";

  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const updateViewport = () => {
      document.documentElement.style.setProperty(
        "--chat-viewport-top",
        `${Math.max(0, visualViewport.offsetTop)}px`,
      );
      document.documentElement.style.setProperty(
        "--chat-viewport-height",
        `${visualViewport.height}px`,
      );
    };

    updateViewport();
    visualViewport.addEventListener("resize", updateViewport);
    visualViewport.addEventListener("scroll", updateViewport);

    return () => {
      visualViewport.removeEventListener("resize", updateViewport);
      visualViewport.removeEventListener("scroll", updateViewport);
      document.documentElement.style.setProperty("--chat-viewport-top", "0px");
      document.documentElement.style.setProperty(
        "--chat-viewport-height",
        "100dvh",
      );
    };
  }, []);

  useEffect(() => {
    if (!replyToast) return;

    const timeoutId = window.setTimeout(() => setReplyToast(null), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [replyToast]);

  useEffect(() => {
    const refreshMessages = () => {
      if (document.visibilityState === "visible") {
        void useMemberStore.getState().load({ force: true });
      }
    };

    const intervalId = window.setInterval(refreshMessages, 3000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    chatImagesRef.current = chatImages;
  }, [chatImages]);

  useEffect(
    () => () =>
      chatImagesRef.current.forEach((image) => URL.revokeObjectURL(image.url)),
    [],
  );

  const conversations = useMemo(() => {
    const grouped = new Map<string, Conversation>();

    messages.forEach((message) => {
      const sentByMe = message.senderId === myProfileId;
      const counterpartId = sentByMe ? message.recipientId : message.senderId;
      const counterpartName = sentByMe
        ? message.recipientName
        : message.senderName;
      const counterpartAvatarUrl = sentByMe
        ? message.recipientAvatarUrl
        : message.senderAvatarUrl;
      const current = grouped.get(counterpartId);
      const unread = !sentByMe && !message.read ? 1 : 0;

      if (!current) {
        grouped.set(counterpartId, {
          counterpartId,
          counterpartName,
          counterpartAvatarUrl,
          latestMessage: message,
          messages: [message],
          unreadCount: unread,
        });
        return;
      }

      current.messages.push(message);
      current.unreadCount += unread;
    });

    return Array.from(grouped.values());
  }, [messages, myProfileId]);
  const openConversationId = requestedThreadId ?? selectedConversationId;
  const openConversation = useMemo(() => {
    const existingOpenConversation =
      conversations.find(
        (conversation) => conversation.counterpartId === openConversationId,
      ) ?? null;

    return (
      existingOpenConversation ??
      (requestedThreadId
        ? {
            counterpartId: requestedThreadId,
            counterpartName: requestedThreadName ?? "상대방",
            counterpartWorkplace: requestedThreadWorkplace ?? undefined,
            counterpartAvatarUrl: requestedThreadAvatarUrl ?? undefined,
            latestMessage: null,
            messages: [],
            unreadCount: 0,
          }
        : null)
    );
  }, [
    conversations,
    openConversationId,
    requestedThreadAvatarUrl,
    requestedThreadId,
    requestedThreadName,
    requestedThreadWorkplace,
  ]);

  useEffect(() => {
    if (
      !openConversation ||
      openConversation.unreadCount === 0 ||
      markedReadThreadRef.current === openConversation.counterpartId
    )
      return;

    markedReadThreadRef.current = openConversation.counterpartId;
    markMemberMessagesRead(openConversation.counterpartId)
      .then(() => {
        void useMemberStore.getState().load({ force: true });
      })
      .catch(() => undefined);
  }, [openConversation]);

  useLayoutEffect(() => {
    const scrollToChatEnd = () =>
      chatEndRef.current?.scrollIntoView({ block: "end", behavior: "auto" });

    scrollToChatEnd();
    let secondFrame: number | undefined;
    const frame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        scrollToChatEnd();
      });
    });

    return () => {
      cancelAnimationFrame(frame);
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
    };
  }, [openConversation?.counterpartId, openConversation?.messages.length]);

  if (messages.length === 0 && !openConversation) {
    const emptyBody = (
      <EmptyMyPageBody
        title="등록된 내역이 없습니다"
        description="받은 대화가 생기면 이곳에 표시됩니다."
      />
    );

    if (!isMyPage) return emptyBody;

    return (
      <div className="member-slide-page min-h-screen w-full overflow-x-hidden bg-[var(--bg)]">
        <MyPageSubHeader title="" />
        {emptyBody}
      </div>
    );
  }

  const openThread = (counterpartId: string) => {
    setSelectedConversationId(counterpartId);
    setReplyBody("");
    setChatImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.url));
      return [];
    });
    setReplyError(null);
    setOpenMessageMenuId(null);
    setReportMessage(null);
  };

  const closeThread = () => {
    if (requestedThreadId) router.replace(pathname);
    setSelectedConversationId(null);
    setReplyBody("");
    setChatImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.url));
      return [];
    });
    setReplyError(null);
    setReplyToast(null);
    setActiveSheet(null);
    setOpenMessageMenuId(null);
    setReportMessage(null);
  };

  const closeMessageReport = () => {
    const messageId = reportMessage?.id;
    setReportMessage(null);
    queueMicrotask(() => {
      if (messageId) messageReportTriggerRefs.current.get(messageId)?.focus();
    });
  };

  const attachChatImageFiles = (files: File[]) => {
    if (files.length === 0) return;

    const remaining = CHAT_IMAGE_ATTACHMENT_LIMIT - chatImages.length;
    if (remaining <= 0) {
      setReplyError(
        `사진은 최대 ${CHAT_IMAGE_ATTACHMENT_LIMIT}장까지 첨부할 수 있습니다.`,
      );
      return;
    }

    if (files.length > remaining) {
      setReplyToast(`사진은 ${remaining}장만 더 첨부할 수 있습니다.`);
    }

    const validFiles = filterImageFiles(
      files.slice(0, remaining),
      MAX_UPLOAD_IMAGE_SIZE,
    );

    setChatImages((current) => [
      ...current,
      ...validFiles.map(createAttachedImage),
    ]);
    setReplyError(null);
  };

  const attachChatImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    attachChatImageFiles(files);
  };

  const openChatImagePicker = async () => {
    setActiveSheet(null);

    if (isNativeImagePickerAvailable()) {
      try {
        const remaining = CHAT_IMAGE_ATTACHMENT_LIMIT - chatImages.length;
        const files = await pickNativeImageFiles(remaining);
        attachChatImageFiles(files ?? []);
      } catch {
        setReplyError("이미지 선택에 실패했습니다. 다시 시도해주세요.");
      }
      return;
    }

    chatImageInputRef.current?.click();
  };

  const removeChatImage = (image: AttachedImage) => {
    setChatImages((current) => current.filter((item) => item.id !== image.id));
    URL.revokeObjectURL(image.url);
  };

  const sendReply = async (
    conversation: NonNullable<typeof openConversation>,
  ) => {
    if (sendingReplyId || (!replyBody.trim() && chatImages.length === 0))
      return;

    setSendingReplyId(conversation.counterpartId);
    setReplyError(null);

    try {
      const imageUrls =
        chatImages.length > 0
          ? await uploadImages(
              chatImages.map((image) => image.file),
              "members/messages",
            )
          : [];
      await sendMemberMessage({
        recipientId: conversation.counterpartId,
        body: replyBody.trim(),
        imageUrls,
      });
      setReplyBody("");
      setChatImages((current) => {
        current.forEach((image) => URL.revokeObjectURL(image.url));
        return [];
      });
      await useMemberStore.getState().load({ force: true });
    } catch (error) {
      setReplyError(
        error instanceof Error ? error.message : "답장을 보내지 못했습니다.",
      );
    } finally {
      setSendingReplyId(null);
    }
  };

  const saveChatSetting = async (
    conversation: NonNullable<typeof openConversation>,
    input: { blocked?: boolean; muted?: boolean },
  ) => {
    if (savingChatSetting) return;

    setSavingChatSetting(true);
    setReplyError(null);
    try {
      await updateMemberChatRoomSetting(conversation.counterpartId, input);
      await useMemberStore.getState().load({ force: true });
      setActiveSheet(null);
      setReplyToast(
        input.blocked === true
          ? "상대를 차단했습니다."
          : input.blocked === false
            ? "차단을 해제했습니다."
            : input.muted
              ? "채팅방 알림을 껐습니다."
              : "채팅방 알림을 켰습니다.",
      );
    } catch (error) {
      setReplyError(
        error instanceof Error
          ? error.message
          : "채팅방 설정 저장에 실패했습니다.",
      );
    } finally {
      setSavingChatSetting(false);
    }
  };

  const leaveChatRoom = async (
    conversation: NonNullable<typeof openConversation>,
  ) => {
    if (savingChatSetting) return;

    setSavingChatSetting(true);
    setReplyError(null);
    try {
      await leaveMemberChatRoom(conversation.counterpartId);
      await useMemberStore.getState().load({ force: true });
      closeThread();
    } catch (error) {
      setReplyError(
        error instanceof Error
          ? error.message
          : "채팅방 나가기에 실패했습니다.",
      );
    } finally {
      setSavingChatSetting(false);
    }
  };

  if (openConversation) {
    const threadMessages = [...openConversation.messages].reverse();
    const sending = sendingReplyId === openConversation.counterpartId;
    const hasMessages = threadMessages.length > 0;
    const canSend = replyBody.trim().length > 0 || chatImages.length > 0;
    const roomSetting = chatRoomSettings.find(
      (setting) => setting.counterpartId === openConversation.counterpartId,
    );

    return (
      <div className="member-slide-page fixed inset-x-0 top-[var(--chat-viewport-top,0px)] z-50 mx-auto flex h-[var(--chat-viewport-height,100dvh)] max-w-[var(--app-shell-max-width)] flex-col overflow-hidden bg-[var(--bg)] shadow-[0_0_0_1px_var(--border)]">
        <header className="z-40 shrink-0 border-b border-[var(--border)] bg-[var(--surface)] pt-[env(safe-area-inset-top)]">
          <div className="grid h-16 grid-cols-[56px_1fr_56px] items-center px-2">
            <button
              type="button"
              aria-label="대화 목록으로 돌아가기"
              onClick={closeThread}
              className="flex h-11 w-11 items-center justify-center text-[var(--fg)]"
            >
              <ArrowLeft size={24} strokeWidth={2.2} />
            </button>
            <div className="min-w-0 text-center">
              <p className="truncate text-[16px] font-bold leading-[1.35] text-[var(--fg-strong)]">
                {openConversation.counterpartName}
              </p>
            </div>
            <button
              type="button"
              aria-label="대화 메뉴"
              onClick={() => setActiveSheet("room")}
              className="flex h-11 w-11 items-center justify-center text-[var(--fg)]"
            >
              <MoreVertical size={22} strokeWidth={2.2} />
            </button>
          </div>
          <div className="flex items-center gap-3 px-5 pb-3">
            {openConversation.counterpartAvatarUrl ? (
              <span
                aria-hidden="true"
                className="h-[38px] w-[38px] rounded-[var(--radius-md)] bg-cover bg-center"
                style={{
                  backgroundImage: `url(${openConversation.counterpartAvatarUrl})`,
                }}
              />
            ) : (
              <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-alt)] text-[var(--fg-muted)]">
                <UserRound size={22} strokeWidth={1.8} />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold leading-[1.35] text-[var(--fg-strong)]">
                {openConversation.counterpartName}
              </p>
              {openConversation.counterpartWorkplace ? (
                <p className="mt-0.5 truncate text-[11px] leading-[1.35] text-[var(--fg-subtle)]">
                  {openConversation.counterpartWorkplace}
                </p>
              ) : null}
            </div>
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-5 pb-5 pt-4">
            <div className="space-y-3">
              {hasMessages ? (
                threadMessages.map((message) => {
                  const sentByMe = message.senderId === myProfileId;

                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "flex items-end gap-2",
                        sentByMe ? "justify-end" : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "relative w-fit max-w-[78%] rounded-[var(--radius-lg)]",
                          sentByMe ? "order-2" : "order-1",
                          message.imageUrls?.length ? "p-1.5" : "px-3 py-2",
                          !sentByMe && "pr-8",
                          sentByMe
                            ? "bg-[var(--fg)] text-[var(--surface)]"
                            : "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--fg)]",
                        )}
                      >
                        {message.imageUrls && message.imageUrls.length > 0 ? (
                          <div className="mb-3 grid grid-cols-2 gap-1.5">
                            {message.imageUrls.map((imageUrl) => (
                              <span
                                key={imageUrl}
                                aria-label="첨부 이미지"
                                className="block aspect-square rounded-[var(--radius-md)] bg-cover bg-center"
                                style={{ backgroundImage: `url(${imageUrl})` }}
                              />
                            ))}
                          </div>
                        ) : null}
                        {message.body ? (
                          <p className="whitespace-pre-wrap break-words text-[14px] leading-6">
                            {message.body}
                          </p>
                        ) : null}
                        {!sentByMe ? (
                          <div className="absolute right-0 top-0 z-10">
                            <button
                              ref={(element) => {
                                if (element)
                                  messageReportTriggerRefs.current.set(
                                    message.id,
                                    element,
                                  );
                                else
                                  messageReportTriggerRefs.current.delete(
                                    message.id,
                                  );
                              }}
                              type="button"
                              aria-label="메시지 더보기"
                              aria-expanded={openMessageMenuId === message.id}
                              onClick={() =>
                                setOpenMessageMenuId((current) =>
                                  current === message.id ? null : message.id,
                                )
                              }
                              className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-pill)] text-[var(--fg-muted)]"
                            >
                              <MoreVertical size={17} strokeWidth={2} />
                            </button>
                            {openMessageMenuId === message.id ? (
                              <div className="absolute right-0 top-8 z-20 w-28 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] py-1 shadow-[var(--shadow-modal)]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMessageMenuId(null);
                                    setReportMessage(message);
                                  }}
                                  className="block w-full px-3 py-2 text-left text-[14px] font-medium text-[var(--fg)]"
                                >
                                  신고
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <div
                        className={cn(
                          "flex shrink-0 flex-col whitespace-nowrap text-[10px] leading-[1.4]",
                          sentByMe
                            ? "order-1 items-end"
                            : "order-2 items-start",
                        )}
                      >
                        {sentByMe ? (
                          <span
                            className={cn(
                              message.read
                                ? "text-[var(--fg-subtle)]"
                                : "font-bold text-[var(--accent)]",
                            )}
                          >
                            {message.read ? "읽음" : "안읽음"}
                          </span>
                        ) : null}
                        <span className="text-[var(--fg-subtle)]">
                          {message.createdAt}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-[13px] leading-6 text-[var(--fg-subtle)]">
                  아직 주고받은 대화가 없습니다.
                </div>
              )}
            </div>
            <div ref={chatEndRef} aria-hidden="true" />
          </div>

          {reportMessage ? (
            <ReportDialog
              targetType="message"
              targetId={reportMessage.id}
              authorId={reportMessage.senderId}
              onClose={closeMessageReport}
            />
          ) : null}

          <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-4 pb-[calc(var(--app-safe-area-bottom)+14px)] pt-3">
            {sending ? (
              <div
                role="status"
                aria-label="메시지 전송 중"
                className="relative mb-3 h-1 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--surface-alt)]"
              >
                <span className="absolute inset-y-0 left-0 w-1/3 animate-[chat-send-progress_900ms_ease-in-out_infinite] rounded-[var(--radius-pill)] bg-[var(--accent)]" />
              </div>
            ) : null}
            {replyError ? (
              <p className="mb-2 text-[12px] font-bold text-[var(--danger)]">
                {replyError}
              </p>
            ) : null}
            {chatImages.length > 0 ? (
              <div className="mb-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {chatImages.map((image) => (
                  <div
                    key={image.id}
                    className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-alt)]"
                  >
                    <span
                      aria-label={image.name}
                      className="block h-full w-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${image.url})` }}
                    />
                    <button
                      type="button"
                      aria-label={`${image.name} 첨부 삭제`}
                      onClick={() => removeChatImage(image)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--fg)]/70 text-white"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <input
              ref={chatImageInputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              multiple
              aria-hidden="true"
              tabIndex={-1}
              className="sr-only"
              onChange={attachChatImages}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="추가 메뉴"
                disabled={sending}
                onClick={() => setActiveSheet("attach")}
                className="flex h-10 w-10 shrink-0 items-center justify-center text-[var(--fg-muted)] disabled:opacity-40"
              >
                <Plus size={24} />
              </button>
              <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--surface-alt)] px-4">
                <input
                  aria-label="메시지"
                  value={replyBody}
                  disabled={sending}
                  onChange={(event) => {
                    setReplyBody(event.target.value.slice(0, 500));
                    setReplyError(null);
                  }}
                  placeholder="메시지 보내기"
                  className="min-w-0 flex-1 bg-transparent text-[16px] leading-6 outline-none placeholder:text-[var(--fg-subtle)] disabled:opacity-70"
                />
                <button
                  type="button"
                  aria-label="이모티콘"
                  onClick={() => setActiveSheet("emoji")}
                  className="flex h-8 w-8 shrink-0 items-center justify-center text-[var(--fg-subtle)]"
                >
                  <SmilePlus size={22} strokeWidth={1.9} />
                </button>
              </label>
              <button
                type="button"
                aria-label="메시지 보내기"
                disabled={!canSend || sending}
                onClick={() => void sendReply(openConversation)}
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-pill)] transition active:scale-95 disabled:cursor-not-allowed",
                  canSend || sending
                    ? "bg-[var(--accent)] text-white shadow-[var(--shadow-card)]"
                    : "bg-[var(--surface-alt)] text-[var(--fg-faint)]",
                )}
              >
                {sending ? (
                  <LoaderCircle
                    size={22}
                    strokeWidth={2.2}
                    className="animate-spin"
                  />
                ) : (
                  <SendHorizontal
                    size={24}
                    fill="currentColor"
                    strokeWidth={1.8}
                  />
                )}
              </button>
            </div>
          </div>
          {replyToast ? <ChatToast message={replyToast} /> : null}
          <ChatActionSheet
            sheet={activeSheet}
            roomSetting={{
              blocked: Boolean(roomSetting?.blocked),
              muted: Boolean(roomSetting?.muted),
            }}
            saving={savingChatSetting || sending}
            onClose={() => setActiveSheet(null)}
            onAppendEmoji={(emoji) => {
              setReplyBody((current) => `${current}${emoji}`.slice(0, 500));
              setActiveSheet(null);
            }}
            onSetBlocked={(blocked) =>
              void saveChatSetting(openConversation, { blocked })
            }
            onSetMuted={(muted) =>
              void saveChatSetting(openConversation, { muted })
            }
            onAttachImage={() => void openChatImagePicker()}
            onLeave={() => void leaveChatRoom(openConversation)}
          />
        </div>
      </div>
    );
  }

  const listBody = (
    <section className="px-6 py-6">
      <div className="space-y-3">
        {conversations.map((conversation) => {
          const message = conversation.latestMessage;
          if (!message) return null;

          return (
            <button
              type="button"
              key={conversation.counterpartId}
              onClick={() => openThread(conversation.counterpartId)}
              className={cn(
                "block w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition active:scale-[0.99]",
                conversation.unreadCount > 0 &&
                  "border-[var(--fg)] bg-[var(--surface-alt)]",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-bold leading-[1.4] text-[var(--fg-strong)]">
                    {conversation.counterpartName}
                  </p>
                  <p className="mt-1 text-[12px] leading-[1.5] text-[var(--fg-subtle)]">
                    최근 대화 · {message.createdAt}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {conversation.unreadCount > 0 ? (
                    <span className="rounded-[var(--radius-pill)] bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold leading-5 text-white">
                      {conversation.unreadCount}
                    </span>
                  ) : null}
                  <ChevronRight size={18} className="text-[var(--fg-subtle)]" />
                </div>
              </div>
              <p className="mt-3 line-clamp-2 text-[14px] leading-6 text-[var(--fg)]">
                {message.body ||
                  (message.imageUrls && message.imageUrls.length > 0
                    ? "사진을 보냈습니다."
                    : "")}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );

  if (!isMyPage) {
    return (
      <div className="member-slide-page min-h-screen w-full overflow-x-hidden bg-[var(--bg)]">
        <HomeSubHeader title="대화함" />
        {listBody}
      </div>
    );
  }

  return (
    <div className="member-slide-page min-h-screen w-full overflow-x-hidden bg-[var(--bg)]">
      <MyPageSubHeader title="" />
      {listBody}
    </div>
  );
}

function ChatActionSheet({
  sheet,
  roomSetting,
  saving,
  onClose,
  onAppendEmoji,
  onSetBlocked,
  onSetMuted,
  onAttachImage,
  onLeave,
}: {
  sheet: ChatActionSheetKind;
  roomSetting: {
    blocked: boolean;
    muted: boolean;
  };
  saving: boolean;
  onClose: () => void;
  onAppendEmoji: (emoji: string) => void;
  onSetBlocked: (blocked: boolean) => void;
  onSetMuted: (muted: boolean) => void;
  onAttachImage: () => void;
  onLeave: () => void;
}) {
  if (!sheet) return null;

  return (
    <div
      role="presentation"
      className="absolute inset-0 z-30 flex items-end bg-black/20"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full rounded-t-[var(--radius-xl)] bg-[var(--surface)] px-4 pb-[calc(var(--app-safe-area-bottom)+12px)] pt-3 shadow-[var(--shadow-modal)]"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="mx-auto mb-3 block h-1 w-10 rounded-[var(--radius-pill)] bg-[var(--border-strong)]" />
        {sheet === "room" ? (
          <div className="overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface-alt)]">
            <ChatSheetButton
              icon={<Ban size={21} />}
              label={roomSetting.blocked ? "차단해제" : "차단하기"}
              disabled={saving}
              onClick={() => onSetBlocked(!roomSetting.blocked)}
            />
            <ChatSheetButton
              icon={<BellOff size={21} />}
              label={roomSetting.muted ? "알림켜기" : "알림끄기"}
              disabled={saving}
              onClick={() => onSetMuted(!roomSetting.muted)}
            />
            <ChatSheetButton
              icon={<LogOut size={21} />}
              label="채팅방 나가기"
              tone="danger"
              disabled={saving}
              onClick={onLeave}
            />
          </div>
        ) : null}
        {sheet === "attach" ? (
          <div className="overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface-alt)]">
            <ChatSheetButton
              icon={<ImagePlus size={21} />}
              label="사진 첨부"
              disabled={saving}
              onClick={onAttachImage}
            />
          </div>
        ) : null}
        {sheet === "emoji" ? (
          <div className="grid grid-cols-6 gap-2 rounded-[var(--radius-lg)] bg-[var(--surface-alt)] p-3">
            {["🙂", "👍", "🙏", "☕", "🔥", "✨"].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onAppendEmoji(emoji)}
                className="flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface)] text-[22px] transition active:scale-95"
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="mt-3 flex h-12 w-full items-center justify-center rounded-[var(--radius-lg)] bg-[var(--surface-alt)] text-[15px] font-bold text-[var(--fg)]"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

function ChatSheetButton({
  icon,
  label,
  tone = "default",
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-14 w-full items-center gap-3 border-b border-[var(--border)] px-5 text-left text-[15px] font-bold disabled:opacity-40 last:border-b-0",
        tone === "danger" ? "text-[var(--danger)]" : "text-[var(--fg)]",
      )}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
        {icon}
      </span>
      {label}
    </button>
  );
}

function ChatToast({ message }: { message: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--app-safe-area-bottom)+92px)] z-40 flex justify-center px-5">
      <p className="rounded-[var(--radius-pill)] bg-[var(--fg)] px-4 py-2 text-[13px] font-bold text-[var(--surface)] shadow-[var(--shadow-modal)]">
        {message}
      </p>
    </div>
  );
}

function InterestScreenBody({
  interests,
}: {
  interests: MemberInterestItem[];
}) {
  if (interests.length === 0) {
    return (
      <EmptyMyPageBody
        title="등록된 내역이 없습니다"
        description="관심 글로 저장한 항목이 생기면 이곳에 표시됩니다."
      />
    );
  }

  return (
    <section>
      <div className="divide-y divide-[var(--border-strong)] px-6 py-8">
        {interests.map((item) => (
          <InterestRow key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

function InterestRow({ item }: { item: MemberInterestItem }) {
  if (isThreadInterest(item)) {
    return <ThreadInterestRow item={item} />;
  }

  if (isPartnerInterest(item)) {
    return <PartnerInterestRow item={item} />;
  }

  return <EventReviewInterestRow item={item} />;
}

function ThreadInterestRow({ item }: { item: MemberInterestItem }) {
  const hasThumbnail = Boolean(item.imageUrl);

  return (
    <article className="py-2">
      <div
        className={cn(
          "grid items-center gap-x-4",
          hasThumbnail ? "grid-cols-[minmax(0,1fr)_64px]" : "grid-cols-1",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-col justify-center gap-1",
            hasThumbnail && "min-h-[64px]",
          )}
        >
          <Link prefetch={false} href={item.href} className="min-w-0">
            <h2 className="line-clamp-2 text-[16px] font-bold leading-[1.35] tracking-[-0.01em] text-[var(--fg-strong)]">
              {item.title}
            </h2>
          </Link>
          <InterestRowMeta item={item} />
        </div>
        {hasThumbnail ? (
          <Link
            prefetch={false}
            href={item.href}
            className="block h-[64px] w-[64px] overflow-hidden rounded-[var(--radius-sm)] bg-[var(--surface-alt)]"
          >
            <ImageBox
              src={item.imageUrl}
              alt={item.title}
              className="h-full w-full"
            />
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function PartnerInterestRow({ item }: { item: MemberInterestItem }) {
  return (
    <article className="py-2">
      <div className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-x-4">
        <div className="flex min-h-[64px] min-w-0 flex-col justify-center gap-1">
          <Link
            prefetch={false}
            href={item.href}
            className="min-w-0 text-[var(--fg)]"
          >
            <h2 className="line-clamp-2 text-[16px] font-bold leading-[1.35] text-[var(--fg-strong)]">
              {item.title}
            </h2>
          </Link>
          <InterestRowMeta item={item} />
        </div>
        <Link
          prefetch={false}
          href={item.href}
          className="block h-[64px] w-[64px] overflow-hidden rounded-[var(--radius-sm)] bg-[var(--surface-alt)]"
        >
          <InterestThumbnail
            src={item.imageUrl}
            alt={item.title}
            className="h-full w-full"
          />
        </Link>
      </div>
    </article>
  );
}

function EventReviewInterestRow({ item }: { item: MemberInterestItem }) {
  return (
    <article className="py-2">
      <div className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-x-4">
        <div className="flex min-h-[64px] min-w-0 flex-col justify-center gap-1">
          <Link
            prefetch={false}
            href={item.href}
            className="min-w-0 text-[var(--fg)]"
          >
            <h3 className="line-clamp-2 text-[16px] font-bold leading-snug text-[var(--fg-strong)]">
              {item.title}
            </h3>
          </Link>
          <InterestRowMeta item={item} />
        </div>
        <Link
          prefetch={false}
          href={item.href}
          className="block h-[64px] w-[64px] overflow-hidden rounded-[var(--radius-sm)] bg-[var(--surface-alt)]"
        >
          <InterestThumbnail
            src={item.imageUrl}
            alt={item.title}
            className="h-full w-full"
          />
        </Link>
      </div>
    </article>
  );
}

function InterestRowMeta({ item }: { item: MemberInterestItem }) {
  return (
    <CompactPostMeta
      href={item.href}
      authorName={item.author}
      dateLabel={item.date}
      viewCount={item.viewCount}
      commentCount={item.commentCount}
      likeCount={item.likeCount}
    />
  );
}

function InterestViewCount({ count }: { count?: number }) {
  return (
    <ViewCountMeta
      count={count ?? 0}
      className="!h-4 w-auto shrink-0 !grid-cols-[14px_auto] !gap-0.5 [&>span]:text-[12px] [&>span]:tabular-nums [&>svg]:h-[14px] [&>svg]:w-[14px]"
    />
  );
}

function InterestMetricGroup({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-4 shrink-0 items-center justify-end gap-1 text-[var(--fg-subtle)]">
      {children}
    </span>
  );
}

function isThreadInterest(item: MemberInterestItem) {
  return (
    item.category === "B-TALK" ||
    item.category === "Q&A" ||
    item.href.startsWith("/community/b-talk") ||
    item.href.startsWith("/community/qa")
  );
}

function isPartnerInterest(item: MemberInterestItem) {
  return (
    item.category === "홍보관" ||
    item.category === "리뷰관" ||
    item.href.startsWith("/partner/")
  );
}

function InterestThumbnail({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  if (src) return <ImageBox src={src} alt={alt} className={className} />;

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-[var(--surface-alt)] text-[var(--fg-faint)]",
        className,
      )}
    >
      <ImageIcon size={22} strokeWidth={1.8} />
    </div>
  );
}

function NoticeScreenBody() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(3);
  const [noticeItems, setNoticeItems] = useState<PublicNotice[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void fetchPublicNotices()
      .then(setNoticeItems)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "공지사항을 불러오지 못했습니다.",
        ),
      );
  }, []);
  const visibleNotices = noticeItems.slice(0, visibleCount);
  const hasMoreNotices = visibleCount < noticeItems.length;

  return (
    <section className="space-y-5 px-6 py-8">
      {visibleNotices.map((notice) => {
        const open = openId === notice.id;
        return (
          <article
            key={notice.id}
            className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5"
          >
            <button
              type="button"
              onClick={() => setOpenId(open ? null : notice.id)}
              className="flex w-full items-center justify-between gap-4 text-left"
            >
              <span className="min-w-0">
                <span className="block text-[16px] font-bold leading-[1.35] tracking-[-0.01em] text-[var(--fg-strong)]">
                  {notice.title}
                </span>
                <span className="mt-2 block text-[12px] leading-[1.5] text-[var(--fg-muted)]">
                  {notice.publishedAt?.slice(0, 10).replaceAll("-", ".")}
                </span>
              </span>
              {open ? (
                <ChevronUp
                  size={22}
                  className="shrink-0 text-[var(--fg-muted)]"
                />
              ) : (
                <ChevronDown
                  size={22}
                  className="shrink-0 text-[var(--fg-muted)]"
                />
              )}
            </button>
            {open ? (
              <p className="mt-4 border-t border-[var(--border)] pt-4 text-[12px] leading-6 text-[var(--fg-muted)]">
                {notice.body}
              </p>
            ) : null}
          </article>
        );
      })}
      {error ? (
        <p className="text-center text-[14px] text-[var(--danger)]">{error}</p>
      ) : null}
      {hasMoreNotices ? (
        <button
          type="button"
          onClick={() =>
            setVisibleCount((current) =>
              Math.min(current + 3, noticeItems.length),
            )
          }
          className="h-14 w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] text-[16px] font-bold text-[var(--fg)]"
        >
          공지사항 더보기
        </button>
      ) : null}
      <div className="grid grid-cols-[32px_1fr] gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
        <Info size={24} className="mt-1" />
        <p className="text-[12px] leading-6 text-[var(--fg)]">
          공지사항에 대한 궁금한 점은{" "}
          <span className="font-bold">카카오톡 채널문의</span>를 이용해 주세요.
        </p>
      </div>
    </section>
  );
}

function FaqScreenBody() {
  const [category, setCategory] = useState<"all" | "guide" | "account">("all");
  const [openId, setOpenId] = useState("");
  const [faqItems, setFaqItems] = useState<PublicFaq[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void fetchPublicFaqs()
      .then(setFaqItems)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "FAQ를 불러오지 못했습니다.",
        ),
      );
  }, []);
  const filters = [
    { value: "all" as const, label: "전체" },
    { value: "guide" as const, label: "이용안내" },
    { value: "account" as const, label: "계정/인증" },
  ];
  const visibleFaqs = faqItems.filter((item) => {
    if (category === "all") return true;
    return item.category === category;
  });

  return (
    <section className="space-y-6 px-6 py-8">
      <SearchField placeholder="궁금한 내용을 검색해보세요" name="faqSearch" />
      <div className="-mx-6">
        <TextTabBar
          ariaLabel="자주 묻는 질문 탭"
          items={filters}
          activeValue={category}
          onChange={setCategory}
        />
      </div>
      <div className="space-y-4">
        {error ? (
          <p className="text-center text-[12px] text-[var(--danger)]">
            {error}
          </p>
        ) : null}
        {visibleFaqs.map((faq) => {
          const open = openId === faq.id;
          return (
            <article
              key={faq.id}
              className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]"
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? "" : faq.id)}
                className="grid w-full grid-cols-[24px_1fr_20px] items-center gap-4 p-5 text-left"
              >
                <span className="text-[16px] font-bold leading-none text-[var(--fg-strong)]">
                  Q
                </span>
                <span className="text-[16px] font-bold leading-[1.35] text-[var(--fg-strong)]">
                  {faq.question}
                </span>
                {open ? (
                  <ChevronUp size={20} className="text-[var(--fg-muted)]" />
                ) : (
                  <ChevronDown size={20} className="text-[var(--fg-muted)]" />
                )}
              </button>
              {open ? (
                <p className="border-t border-[var(--border)] bg-[var(--surface-alt)] p-5 text-[12px] leading-6 text-[var(--fg-muted)]">
                  {faq.answer}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-alt)] p-5 text-center">
        <h2 className="text-[16px] font-bold leading-[1.35] tracking-[-0.01em] text-[var(--fg-strong)]">
          원하는 답변을 찾지 못하셨나요?
        </h2>
        <p className="mt-3 text-[12px] leading-6 text-[var(--fg-muted)]">
          카카오톡 채널을 통해 궁금한 점을 해결해 드립니다.
        </p>
        <button
          type="button"
          className="mt-6 w-full rounded-[var(--radius-lg)] bg-[var(--accent)] px-6 py-5 text-[16px] font-bold text-white shadow-[var(--shadow-card)] active:scale-[0.98]"
        >
          카카오톡 채널 문의
        </button>
      </div>
    </section>
  );
}

function NotificationSettingsBody({
  settings,
}: {
  settings: NotificationSettings;
}) {
  const setNotificationSetting = useMemberStore(
    (state) => state.setNotificationSetting,
  );
  const setNotificationSettings = useMemberStore(
    (state) => state.setNotificationSettings,
  );
  const [savingKey, setSavingKey] = useState<NotificationSettingKey | null>(
    null,
  );

  const handleToggle = async (key: NotificationSettingKey) => {
    if (key === "accountSecurity") return;
    if (key === "nightNotifications" && !settings.benefitsMarketing) return;

    const previousSettings = settings;
    const next = !settings[key];
    const patch: Partial<NotificationSettings> =
      key === "benefitsMarketing" && !next
        ? { benefitsMarketing: false, nightNotifications: false }
        : { [key]: next };

    Object.entries(patch).forEach(([patchKey, value]) => {
      setNotificationSetting(
        patchKey as NotificationSettingKey,
        Boolean(value),
      );
    });
    setSavingKey(key);

    try {
      const response = await updateNotificationSettings(patch);
      setNotificationSettings(response.settings);
    } catch (error) {
      setNotificationSettings(previousSettings);
      window.alert(
        error instanceof Error
          ? error.message
          : "알림 설정 저장에 실패했습니다.",
      );
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <section className="space-y-9 px-6 py-8">
      {notificationSections.map((section, sectionIndex) => (
        <div
          key={section.title}
          className={cn(
            sectionIndex > 0 && "border-t border-[var(--border)] pt-8",
          )}
        >
          <h2 className="text-[16px] font-bold leading-[1.35] tracking-[-0.01em] text-[var(--fg-strong)]">
            {section.title}
          </h2>
          <p className="mt-2 text-[12px] leading-6 text-[var(--fg-muted)]">
            {section.description}
          </p>
          <div className="mt-5 space-y-3">
            {section.items.map((item) => {
              const alwaysOn = item.id === "accountSecurity";
              const disabled =
                item.id === "nightNotifications" && !settings.benefitsMarketing;
              const enabled = alwaysOn || settings[item.id];
              const saving = savingKey === item.id;
              return (
                <article
                  key={item.title}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5"
                >
                  <div>
                    <h3 className="text-[16px] font-bold leading-[1.4] text-[var(--fg-strong)]">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-[12px] leading-6 text-[var(--fg-muted)]">
                      {item.description}
                    </p>
                  </div>
                  {alwaysOn ? (
                    <span className="justify-self-end rounded-[var(--radius-pill)] bg-[var(--surface-alt)] px-3 py-1 text-[12px] font-bold leading-5 text-[var(--fg-muted)]">
                      항상 수신
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-label={`${item.title} 설정`}
                      aria-pressed={enabled}
                      disabled={saving || disabled}
                      onClick={() => void handleToggle(item.id)}
                      className={cn(
                        "flex h-6 w-11 items-center rounded-[var(--radius-pill)] p-0.5 transition-colors duration-200 ease-out disabled:opacity-40",
                        enabled
                          ? "justify-end bg-[var(--accent)]"
                          : "justify-start bg-[var(--fg-faint)]",
                        saving && "opacity-60",
                      )}
                    >
                      <span className="h-5 w-5 rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--surface)]" />
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      ))}
      <div className="space-y-5 text-center text-[12px] leading-6 text-[var(--fg-muted)]">
        <p>
          알림 설정을 변경하면 반영되기까지 최대 24시간이 소요될 수 있습니다.
        </p>
        <p className="flex justify-center gap-6 font-bold text-[var(--fg)] underline underline-offset-4">
          <Link prefetch={false} href="/login/terms">
            서비스 이용약관
          </Link>
          <Link prefetch={false} href="/login/privacy">
            개인정보 처리방침
          </Link>
        </p>
      </div>
    </section>
  );
}

function WithdrawScreen() {
  const router = useRouter();
  const [selectedReason, setSelectedReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmDialogRef = useRef<HTMLDialogElement>(null);
  const cancelWithdrawalRef = useRef<HTMLButtonElement>(null);
  const reasons = [
    "서비스 사용이 어렵고 불편함",
    "원하는 정보/콘텐츠가 부족함",
    "개인정보 노출 및 보안 우려",
    "다른 계정으로 재가입 희망",
  ];
  const lossItems = [
    { icon: Shield, label: "프로필·경력·포트폴리오 및 개인 파일 삭제" },
    { icon: RotateCcw, label: "게시물·댓글·메시지는 작성자 정보 익명화" },
    { icon: CreditCard, label: "결제 정보 및 포인트 소멸" },
  ];
  const canSubmit = selectedReason && agreed;

  useEffect(() => {
    const dialog = confirmDialogRef.current;
    if (!dialog) return;
    if (confirmOpen) {
      if (!dialog.open) dialog.showModal();
      cancelWithdrawalRef.current?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [confirmOpen]);

  const confirmWithdrawal = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await deleteMemberAccount({
        reason: selectedReason,
        ...(feedback.trim() ? { feedback: feedback.trim() } : {}),
      });
      router.replace("/login");
      router.refresh();
    } catch (withdrawalError) {
      setError(
        withdrawalError instanceof Error
          ? withdrawalError.message
          : "회원 탈퇴에 실패했습니다.",
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="member-slide-page min-h-screen bg-[var(--bg)]">
      <MyPageSubHeader title="회원 탈퇴" />
      <main className="space-y-8 px-6 py-8">
        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="grid grid-cols-[52px_1fr] gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-alt)] text-[var(--danger)]">
              <AlertTriangle size={24} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-[20px] font-bold leading-[1.3] tracking-[-0.01em] text-[var(--fg-strong)]">
                잠깐만요! 탈퇴 전 확인해 주세요
              </h1>
              <p className="mt-2 text-[14px] leading-6 text-[var(--fg-muted)]">
                프로필과 개인 데이터는 삭제되며, 작성한 게시물·댓글·메시지는
                &apos;탈퇴한 유저&apos;로 익명화되어 유지됩니다.
              </p>
              <p className="mt-2 text-[14px] leading-6 text-[var(--fg-muted)]">
                탈퇴 즉시 로그인이 차단되며, 개인 데이터 삭제 완료까지 최대
                24시간이 걸릴 수 있습니다.
              </p>
            </div>
          </div>
          <div className="mt-6 space-y-3 border-t border-[var(--border)] pt-5">
            {lossItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="grid grid-cols-[32px_1fr] items-center gap-3 rounded-[var(--radius-md)] bg-[var(--surface-alt)] px-4 py-3"
                >
                  <Icon size={22} className="text-[var(--fg-muted)]" />
                  <span className="text-[14px] leading-6 text-[var(--fg)]">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-[16px] font-bold text-[var(--fg-strong)]">
            탈퇴 사유를 선택해 주세요 (필수)
          </h2>
          <div className="mt-4 space-y-3">
            {reasons.map((reason) => {
              const selected = selectedReason === reason;
              return (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setSelectedReason(reason)}
                  className={cn(
                    "grid h-16 w-full grid-cols-[1fr_28px] items-center gap-4 rounded-[var(--radius-md)] border bg-[var(--surface)] px-5 text-left",
                    selected
                      ? "border-[var(--accent)]"
                      : "border-[var(--border-strong)]",
                  )}
                >
                  <span className="text-[16px] text-[var(--fg)]">{reason}</span>
                  <span
                    className={
                      selected
                        ? "h-[18px] w-[18px] justify-self-end rounded-[var(--radius-pill)] border-[5px] border-[var(--accent)]"
                        : "h-[18px] w-[18px] justify-self-end rounded-[var(--radius-pill)] border border-[var(--fg-muted)]"
                    }
                  />
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <label
            htmlFor="withdrawFeedback"
            className="text-[16px] font-bold text-[var(--fg-strong)]"
          >
            기타 의견 (선택)
          </label>
          <textarea
            id="withdrawFeedback"
            value={feedback}
            maxLength={1000}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder="더 나은 서비스를 위해 고쳐야 할 점을 알려주세요."
            className="mt-3 min-h-36 w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] p-4 text-[16px] leading-7 text-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)]"
          />
        </section>

        <label className="grid grid-cols-[28px_1fr] gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
          <span
            className={cn(
              "mt-1 flex h-[18px] w-[18px] items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-strong)]",
              agreed && "border-[var(--accent)] bg-[var(--accent)] text-white",
            )}
          >
            {agreed ? <Check size={14} strokeWidth={3} /> : null}
          </span>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="sr-only"
          />
          <span className="text-[16px] leading-7 text-[var(--fg)]">
            위 안내 사항을 모두 확인하였으며, 데이터 영구 삭제 및 복구 불가에
            동의하여 최종 탈퇴를 진행합니다.
          </span>
        </label>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => setConfirmOpen(true)}
          className={cn(
            "w-full rounded-[var(--radius-lg)] bg-[var(--danger)] py-5 text-[18px] font-bold text-white active:scale-[0.98]",
            !canSubmit && "cursor-not-allowed opacity-40",
          )}
        >
          회원 탈퇴하기
        </button>
      </main>

      {confirmOpen ? (
        <dialog
          ref={confirmDialogRef}
          aria-labelledby="withdraw-confirm-title"
          onCancel={(event) => {
            event.preventDefault();
            if (!submitting) setConfirmOpen(false);
          }}
          className="m-auto w-[calc(100%-3rem)] max-w-[360px] border-0 bg-transparent p-0 backdrop:bg-black/40"
        >
          <section className="w-full max-w-[360px] rounded-[var(--radius-xl)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-modal)]">
            <h2
              id="withdraw-confirm-title"
              className="text-[20px] font-bold tracking-[-0.01em] text-[var(--fg-strong)]"
            >
              정말 탈퇴하시겠습니까?
            </h2>
            <p className="mt-4 text-[14px] leading-6 text-[var(--fg-muted)]">
              개인 데이터는 영구 삭제되고 공유 콘텐츠는 익명화되며 복구할 수
              없습니다.
            </p>
            {error ? (
              <p
                role="alert"
                className="mt-4 text-[13px] font-medium text-[var(--danger)]"
              >
                {error}
              </p>
            ) : null}
            <div className="mt-8 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={confirmWithdrawal}
                className="h-14 rounded-[var(--radius-lg)] bg-[var(--danger)] text-[16px] font-bold text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? "탈퇴 처리 중..." : "탈퇴하기"}
              </button>
              <button
                ref={cancelWithdrawalRef}
                type="button"
                disabled={submitting}
                onClick={() => setConfirmOpen(false)}
                className="h-14 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] text-[16px] font-bold text-[var(--fg)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                취소
              </button>
            </div>
          </section>
        </dialog>
      ) : null}
    </div>
  );
}

function SearchField({
  placeholder,
  name,
}: {
  placeholder: string;
  name: string;
}) {
  return (
    <label className="flex h-14 items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-5">
      <Search size={22} className="text-[var(--fg-muted)]" />
      <input
        name={name}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[var(--fg-subtle)]"
        placeholder={placeholder}
      />
    </label>
  );
}

function EmptyMyPageBody({
  title,
  description,
  compact = false,
}: {
  title: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <section className={cn("px-6 text-center", compact ? "py-12" : "py-24")}>
      <p className="text-[16px] font-bold leading-[1.35] text-[var(--fg-strong)]">
        {title}
      </p>
      {description ? (
        <p className="mt-3 text-[12px] leading-6 text-[var(--fg-muted)]">
          {description}
        </p>
      ) : null}
    </section>
  );
}

function ConfirmModal({
  action,
  onClose,
}: {
  action: "logout" | null;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  if (!action) return null;

  const confirmLogout = async () => {
    if (submitting) return;

    setSubmitting(true);
    try {
      await logout();
    } finally {
      window.location.assign("/login");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <section className="w-full max-w-[360px] rounded-[var(--radius-xl)] bg-[var(--surface)] p-6 shadow-[var(--shadow-modal)]">
        <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[var(--fg-strong)]">
          로그아웃
        </h2>
        <p className="mt-3 whitespace-pre-line text-[14px] leading-6 text-[var(--fg-muted)]">
          정말 로그아웃 하시겠습니까?{"\n"}다음에 다시 만나요!
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-6 py-5 text-[18px] font-bold text-[var(--fg)] active:scale-[0.98]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={confirmLogout}
            disabled={submitting}
            className="rounded-[var(--radius-lg)] bg-[var(--accent)] px-6 py-5 text-[18px] font-bold text-white shadow-[var(--shadow-card)] active:scale-[0.98]"
          >
            {submitting ? "로그아웃 중" : "로그아웃"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ProfileEditScreen({ profile }: { profile: MemberProfile }) {
  const selectedStatus = useMemberStore((state) => state.selectedStatus);
  const setSelectedStatus = useMemberStore((state) => state.setSelectedStatus);
  const baristaProfile = profile.baristaProfile;
  const isEnthusiast = profile.role === "enthusiast";
  const [avatar, setAvatar] = useState<AttachedImage | null>(null);
  const [name, setName] = useState(profile.name);
  const [nickname, setNickname] = useState(profile.handle);
  const [activityRegion, setActivityRegion] = useState(
    profile.activityRegion ?? "",
  );
  const [contactPhone, setContactPhone] = useState(
    baristaProfile?.contactPhone ?? "",
  );
  const [intro, setIntro] = useState(profile.bio);
  const [preparingBusiness, setPreparingBusiness] = useState(false);
  const [workplaces, setWorkplaces] = useState(
    profile.workplaceLocations?.length
      ? profile.workplaceLocations.map((location) =>
          location.name === location.address ? "" : location.name,
        )
      : profile.workplaces.length > 0
        ? profile.workplaces
        : [profile.workplace],
  );
  const [workplaceLocations, setWorkplaceLocations] = useState<
    Array<WorkplaceLocation | null>
  >(
    profile.workplaceLocations?.length
      ? profile.workplaceLocations
      : Array.from(
          {
            length: Math.max(
              1,
              profile.workplaces.length > 0 ? profile.workplaces.length : 1,
            ),
          },
          () => null,
        ),
  );
  const [workplaceEmploymentTypes, setWorkplaceEmploymentTypes] = useState<
    string[][]
  >(() => {
    const locations = profile.workplaceLocations ?? [];
    if (locations.length > 0) {
      return locations.map((location, index) =>
        location.employmentTypes?.length
          ? location.employmentTypes
          : index === 0
            ? (baristaProfile?.employmentTypes ?? [])
            : [],
      );
    }
    const length = Math.max(
      1,
      profile.workplaces.length > 0 ? profile.workplaces.length : 1,
    );
    return Array.from({ length }, (_, index) =>
      index === 0 ? (baristaProfile?.employmentTypes ?? []) : [],
    );
  });
  const [selectedSkills, setSelectedSkills] = useState(
    normalizeBaristaSpecialties(profile.specialties),
  );
  const [customSkillInput, setCustomSkillInput] = useState("");
  const [customSkillOpen, setCustomSkillOpen] = useState(false);
  const [selectedCertifications, setSelectedCertifications] = useState<
    string[]
  >(certificationSelections(profile.certificateName));
  const totalExperience = baristaProfile?.totalExperience ?? "";
  const [certificateFiles, setCertificateFiles] = useState<AttachedImage[]>([]);
  const [espressoMachineBrands, setEspressoMachineBrands] = useState(
    normalizeBrandSelections(
      baristaProfile?.espressoMachineBrands ?? [],
      baristaProfile?.espressoMachineBrandOther,
    ),
  );
  const [espressoMachineBrandInput, setEspressoMachineBrandInput] =
    useState("");
  const [espressoMachineBrandInputOpen, setEspressoMachineBrandInputOpen] =
    useState(false);
  const [grinderBrands, setGrinderBrands] = useState(
    normalizeBrandSelections(
      baristaProfile?.grinderBrands ?? [],
      baristaProfile?.grinderBrandOther,
    ),
  );
  const [grinderBrandInput, setGrinderBrandInput] = useState("");
  const [grinderBrandInputOpen, setGrinderBrandInputOpen] = useState(false);
  const [roasterBrands, setRoasterBrands] = useState(
    normalizeBrandSelections(
      baristaProfile?.roasterBrands ?? [],
      baristaProfile?.roasterBrandOther,
    ),
  );
  const [roasterBrandInput, setRoasterBrandInput] = useState("");
  const [roasterBrandInputOpen, setRoasterBrandInputOpen] = useState(false);
  const [preferredBeans, setPreferredBeans] = useState<string[]>(
    parsePreferredBeans(baristaProfile?.preferredBeans ?? ""),
  );
  const [preferredBeanInput, setPreferredBeanInput] = useState("");
  const [preferredBeanNotes, setPreferredBeanNotes] = useState(
    baristaProfile?.preferredBeanNotes ?? [],
  );
  const [socials, setSocials] = useState(profile.socials);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postcodeSearchOpen, setPostcodeSearchOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { startImageCrop, imageCropEditor } = useImageCropFlow(
    ([file]) => {
      if (!file) return;
      setAvatar((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return createAttachedImage(file);
      });
    },
    { fixedAspect: "square", touchOnly: true, cropGuideShape: "circle" },
  );

  useEffect(
    () => () => {
      if (avatar) URL.revokeObjectURL(avatar.url);
    },
    [avatar],
  );

  useEffect(
    () => () => {
      certificateFiles.forEach((file) => URL.revokeObjectURL(file.url));
    },
    [certificateFiles],
  );

  const attachAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!isSupportedImage(file)) {
      window.alert("JPG, PNG 이미지만 첨부할 수 있습니다.");
      return;
    }
    startImageCrop([file]);
  };

  const openAvatarPicker = async () => {
    try {
      const file = await selectProfileImage({
        isNativePickerAvailable: isNativeImagePickerAvailable,
        pickNativeImageFiles,
        openFallback: () => avatarInputRef.current?.click(),
      });
      if (!file) return;
      if (!isSupportedImage(file)) {
        window.alert("JPG, PNG 이미지만 첨부할 수 있습니다.");
        return;
      }
      startImageCrop([file]);
    } catch {
      window.alert("이미지 선택에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const attachCertificateFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    if (!files.every(isSupportedDocument)) {
      window.alert("PDF, JPG, PNG 파일만 첨부할 수 있습니다.");
      event.target.value = "";
      return;
    }
    setCertificateFiles((current) => [
      ...current,
      ...files.map(createAttachedFile),
    ]);
    event.target.value = "";
  };

  const removeCertificateFile = (id: string) => {
    setCertificateFiles((current) => {
      const removed = current.find((file) => file.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return current.filter((file) => file.id !== id);
    });
  };

  const updateWorkplace = (index: number, value: string) => {
    setWorkplaces((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
    setWorkplaceLocations((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index && item ? withWorkplaceName(item, value) : item,
      ),
    );
  };

  const selectWorkplace = (index: number, location: WorkplaceLocation) => {
    const workplaceName =
      workplaces[index]?.trim() ||
      (location.name === location.address ? "" : location.name);
    const employmentTypes =
      workplaceEmploymentTypes[index] ?? location.employmentTypes ?? [];
    setWorkplaces((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? workplaceName : item,
      ),
    );
    setWorkplaceLocations((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? withWorkplaceName({ ...location, employmentTypes }, workplaceName)
          : item,
      ),
    );
  };

  const addWorkplace = () => {
    setWorkplaces((current) => {
      if (current.length >= 3) return current;
      setWorkplaceLocations((locations) => [...locations, null]);
      setWorkplaceEmploymentTypes((types) => [...types, []]);
      return [...current, ""];
    });
  };

  const removeWorkplace = (index: number) => {
    setWorkplaces((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      return next.length > 0 ? next : [""];
    });
    setWorkplaceLocations((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      return next.length > 0 ? next : [null];
    });
    setWorkplaceEmploymentTypes((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      return next.length > 0 ? next : [[]];
    });
  };

  const updateWorkplaceEmploymentTypes = (
    index: number,
    nextTypes: string[],
  ) => {
    setWorkplaceEmploymentTypes((current) =>
      current.map((types, itemIndex) =>
        itemIndex === index ? nextTypes : types,
      ),
    );
    setWorkplaceLocations((current) =>
      current.map((location, itemIndex) =>
        itemIndex === index && location
          ? withWorkplaceName(
              { ...location, employmentTypes: nextTypes },
              workplaces[index] ?? "",
            )
          : location,
      ),
    );
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills((current) => {
      if (current.includes(skill))
        return current.filter((item) => item !== skill);
      if (current.length >= 5) return current;
      return [...current, skill];
    });
  };

  const addCustomSkill = () => {
    const skill = customSkillInput.trim();
    if (!skill) {
      setCustomSkillOpen(true);
      return;
    }
    setSelectedSkills((current) => {
      if (current.includes(skill) || current.length >= 5) return current;
      return [...current, skill];
    });
    setCustomSkillInput("");
    setCustomSkillOpen(false);
  };

  const toggleCertification = (
    certificate: (typeof CERTIFICATION_OPTIONS)[number],
  ) => {
    setSelectedCertifications((current) =>
      toggleStringSelection(current, certificate),
    );
  };

  const hasWorkplace =
    preparingBusiness ||
    workplaceLocations.some(
      (location, index) => Boolean(location) && workplaces[index]?.trim(),
    );
  const canSave = profileEditCanSave({
    role: profile.role,
    name,
    nickname,
    skillCount: selectedSkills.length,
    hasWorkplace,
  });

  const saveProfile = async () => {
    if (!canSave || saving) return;

    setSaving(true);
    setError(null);
    try {
      const [avatarUrl] = avatar
        ? await uploadImages([avatar.file], "members/avatars")
        : [];
      const certificateFileUrls =
        certificateFiles.length > 0
          ? await uploadProfileDocuments(
              certificateFiles.map((file) => file.file),
              "members/certificates",
            )
          : [];
      const namedLocations = workplaceLocations.flatMap((location, index) => {
        const workplaceName = workplaces[index]?.trim();
        if (!location || !workplaceName) return [];
        return [
          withWorkplaceName(
            {
              ...location,
              employmentTypes: workplaceEmploymentTypes[index] ?? [],
            },
            workplaceName,
          ),
        ];
      });
      const employmentTypes = Array.from(
        new Set(
          namedLocations.flatMap((location) => location.employmentTypes ?? []),
        ),
      );
      const storedProfession = baristaProfile ?? {
        contactPhone: "",
        employmentTypes: [],
        totalExperience: "",
        certificateFileUrls: [],
        espressoMachineBrands: [],
        espressoMachineBrandOther: "",
        grinderBrands: [],
        grinderBrandOther: "",
        roasterBrands: [],
        roasterBrandOther: "",
        preferredBeans: "",
        preferredBeanNotes: [],
      };
      await updateMemberProfile({
        name: name.trim(),
        handle: nickname.trim(),
        avatarUrl,
        status: selectedStatus,
        specialties: normalizeBaristaSpecialties(selectedSkills),
        bio: intro.trim(),
        socials,
        ...(profileEditKeepsStoredProfession(profile.role)
          ? {
              activityRegion: activityRegion.trim(),
              baristaProfile: {
                ...storedProfession,
                preferredBeanNotes,
              },
            }
          : {
              workplaces: preparingBusiness
                ? []
                : namedLocations.map((location) => location.name),
              workplaceLocations: preparingBusiness ? [] : namedLocations,
              certificateName: selectedCertifications.join(", "),
              baristaProfile: {
                contactPhone: contactPhone.trim(),
                employmentTypes,
                totalExperience,
                certificateFileUrls: [
                  ...(baristaProfile?.certificateFileUrls ?? []),
                  ...certificateFileUrls,
                ],
                espressoMachineBrands: normalizeBrandSelections(
                  espressoMachineBrands,
                ),
                espressoMachineBrandOther: "",
                grinderBrands: normalizeBrandSelections(grinderBrands),
                grinderBrandOther: "",
                roasterBrands: normalizeBrandSelections(roasterBrands),
                roasterBrandOther: "",
                preferredBeans: formatPreferredBeans(preferredBeans),
                preferredBeanNotes,
              },
            }),
      });
      window.location.assign("/home");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "프로필 저장에 실패했습니다.",
      );
      setSaving(false);
    }
  };

  return (
    <>
      <HomeSubHeader
        title={isEnthusiast ? "프로필 관리" : "바리스타 프로필 관리"}
      />
      {imageCropEditor}
      <section className="space-y-8 px-6 py-8 pb-[calc(var(--app-safe-area-bottom)+112px)]">
        <input
          ref={avatarInputRef}
          type="file"
          name="avatar"
          accept="image/jpeg,image/png"
          className="sr-only"
          onChange={attachAvatar}
        />
        <button
          type="button"
          aria-label="프로필 이미지 등록"
          className="relative block h-28 w-28 overflow-hidden rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--surface-alt)]"
          onClick={openAvatarPicker}
        >
          {avatar ? (
            <Image
              src={avatar.url}
              alt={avatar.name}
              fill
              unoptimized
              sizes="112px"
              className="object-cover"
            />
          ) : (
            <Avatar
              size="full"
              src={profile.avatarUrl}
              alt={`${profile.name} 프로필 이미지`}
            />
          )}
          <span className="absolute inset-x-4 top-10 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1 text-center text-[12px] font-medium">
            이미지 등록
          </span>
        </button>

        {isEnthusiast ? null : (
          <section>
            <FieldLabel variant="profile">상태 메시지</FieldLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedStatus(option.value)}
                  className={cn(
                    "rounded-[var(--radius-pill)] border px-3 py-2 text-[13px] font-medium",
                    selectedStatus === option.value
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] font-bold text-[var(--fg)]"
                      : "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--fg)]",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-1 text-[12px] text-[var(--fg-muted)]">
              {statusOptions.map((option) => (
                <p key={option.value}>
                  <span
                    className={cn(
                      "mr-1 inline-block h-2 w-2 rounded-[var(--radius-pill)]",
                      statusMeta(option.value).dot,
                    )}
                  />
                  {option.description}
                </p>
              ))}
            </div>
          </section>
        )}

        <Divider />
        <label className="block">
          <FieldLabel variant="profile">성명 *</FieldLabel>
          <input
            name="profileName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 h-12 w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-[16px] outline-none focus:border-[var(--accent)]"
          />
        </label>

        <label className="block">
          <FieldLabel variant="profile">닉네임 *</FieldLabel>
          <input
            name="profileNickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            className="mt-2 h-12 w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-[16px] outline-none focus:border-[var(--accent)]"
          />
        </label>

        {isEnthusiast ? (
          <label className="block">
            <FieldLabel variant="profile">활동 지역</FieldLabel>
            <input
              name="activityRegion"
              value={activityRegion}
              onChange={(event) => setActivityRegion(event.target.value)}
              placeholder="서울 마포구"
              className="mt-2 h-12 w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-[16px] outline-none placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)]"
            />
          </label>
        ) : null}

        {isEnthusiast ? null : (
          <>
            <label className="block">
              <FieldLabel variant="profile">연락처</FieldLabel>
              <input
                name="profileContactPhone"
                value={contactPhone}
                onChange={(event) =>
                  setContactPhone(formatPhoneNumber(event.target.value))
                }
                inputMode="tel"
                placeholder="010-0000-0000"
                className="mt-2 h-12 w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-[16px] outline-none placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)]"
              />
            </label>

            <label className="flex items-center gap-2 text-[13px]">
              <input
                name="preparingBusiness"
                type="checkbox"
                checked={preparingBusiness}
                onChange={(event) => setPreparingBusiness(event.target.checked)}
                className="h-4 w-4 accent-[var(--fg)]"
              />
              창업준비중
            </label>

            <section
              className={cn(
                "rounded-[var(--radius-lg)] border border-[var(--border-strong)] p-4 transition-opacity",
                preparingBusiness && "opacity-40",
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[12px] font-medium text-[var(--fg-muted)]">
                  소속 최대 3개
                </span>
                <button
                  type="button"
                  aria-label="소속 주소 추가"
                  onClick={addWorkplace}
                  disabled={preparingBusiness || workplaces.length >= 3}
                  className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--border-strong)] text-[var(--fg-muted)] disabled:opacity-30"
                >
                  <Plus size={18} />
                </button>
              </div>
              <div className="space-y-3">
                {workplaces.map((workplace, index) => (
                  <WorkplaceSearchInput
                    key={index}
                    name={`workplace-${index}`}
                    label={`소속 ${index + 1}`}
                    storeLabel={
                      index === 0
                        ? "현재 소속 매장명"
                        : `추가 소속 매장명 ${index + 1}`
                    }
                    addressLabel={
                      index === 0
                        ? "매장 상세 주소"
                        : `추가 매장 상세 주소 ${index + 1}`
                    }
                    value={workplace}
                    selectedLocation={workplaceLocations[index] ?? undefined}
                    disabled={preparingBusiness}
                    onChange={(value) => updateWorkplace(index, value)}
                    onSelect={(location) => selectWorkplace(index, location)}
                    onRemove={() => removeWorkplace(index)}
                    removable={workplaces.length > 1}
                    employmentTypes={workplaceEmploymentTypes[index] ?? []}
                    onEmploymentTypesChange={(types) =>
                      updateWorkplaceEmploymentTypes(index, types)
                    }
                    onSearchOpenChange={setPostcodeSearchOpen}
                  />
                ))}
              </div>
            </section>

            <section>
              <FieldLabel variant="profile">자격증</FieldLabel>
              <div className="mt-2 rounded-[var(--radius-lg)] border border-[var(--border-strong)] p-3">
                <FilterChips
                  options={CERTIFICATION_OPTIONS}
                  selected={selectedCertifications}
                  onToggle={(value) =>
                    toggleCertification(
                      value as (typeof CERTIFICATION_OPTIONS)[number],
                    )
                  }
                />
              </div>
              <div className="mt-4">
                <FieldLabel variant="profile">자격증명서</FieldLabel>
              </div>
              <label className="mt-3 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-dashed)] bg-[var(--surface-alt)] px-4 py-5 text-center text-[13px] font-medium text-[var(--fg-muted)]">
                <input
                  type="file"
                  name="certificateFiles"
                  accept={DOCUMENT_ACCEPT}
                  multiple
                  className="sr-only"
                  onChange={attachCertificateFiles}
                />
                PDF, JPG, PNG 파일 업로드
              </label>
              {certificateFiles.length > 0 ||
              (baristaProfile?.certificateFileUrls.length ?? 0) > 0 ? (
                <div className="mt-3 space-y-2">
                  {baristaProfile?.certificateFileUrls.map((url, index) => (
                    <div
                      key={url}
                      className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-strong)] px-3 py-2 text-[13px] text-[var(--fg-muted)]"
                    >
                      <span>등록된 파일 {index + 1}</span>
                      <span className="truncate pl-3">{url}</span>
                    </div>
                  ))}
                  {certificateFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-strong)] px-3 py-2 text-[13px] text-[var(--fg)]"
                    >
                      <span className="truncate">
                        {file.name} · {formatFileSize(file.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeCertificateFile(file.id)}
                        className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-pill)] text-[var(--fg-muted)]"
                        aria-label={`${file.name} 삭제`}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          </>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <FieldLabel variant="profile">
              {isEnthusiast ? "취향 키워드" : "전문 분야 *"}
            </FieldLabel>
            <span
              className={cn(
                "text-[12px]",
                selectedSkills.length >= 5
                  ? "text-[var(--accent)]"
                  : "text-[var(--fg-muted)]",
              )}
            >
              {selectedSkills.length}/5 선택
            </span>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-strong)] p-3">
            <div className="flex flex-wrap gap-2">
              {BARISTA_SPECIALTIES.map((specialty) => (
                <button
                  key={specialty.value}
                  type="button"
                  onClick={() => toggleSkill(specialty.value)}
                  className={cn(
                    "rounded-[var(--radius-pill)] border px-3 py-1 text-[12px] font-medium",
                    selectedSkills.includes(specialty.value)
                      ? "border-[var(--fg)] bg-[var(--fg)] font-bold text-[var(--surface)]"
                      : "border-[var(--border-strong)] bg-[var(--surface-alt)] text-[var(--fg-muted)]",
                  )}
                >
                  {specialty.label}
                </button>
              ))}
              {selectedSkills
                .filter((skill) => !isDefaultSpecialty(skill))
                .map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className="rounded-[var(--radius-pill)] border border-[var(--fg)] bg-[var(--fg)] px-3 py-1 text-[12px] font-bold text-[var(--surface)]"
                  >
                    {skill}
                  </button>
                ))}
              <button
                type="button"
                onClick={() => {
                  if (customSkillOpen) {
                    addCustomSkill();
                    return;
                  }
                  setCustomSkillOpen(true);
                }}
                disabled={selectedSkills.length >= 5 && !customSkillOpen}
                className="rounded-[var(--radius-pill)] border border-dashed border-[var(--border-dashed)] px-3 py-1 text-[12px] text-[var(--fg-muted)]"
              >
                {isEnthusiast ? "+ 키워드 추가" : "+ 분야 추가"}
              </button>
            </div>
            {customSkillOpen ? (
              <div className="mt-3 flex gap-2">
                <input
                  name="customSpecialty"
                  value={customSkillInput}
                  onChange={(event) => setCustomSkillInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCustomSkill();
                    }
                  }}
                  placeholder={
                    isEnthusiast
                      ? "취향 키워드를 입력하세요."
                      : "전문 분야를 입력하세요."
                  }
                  className="h-11 min-w-0 flex-1 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-[15px] outline-none placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={addCustomSkill}
                  disabled={
                    !customSkillInput.trim() || selectedSkills.length >= 5
                  }
                  className="h-11 rounded-[var(--radius-lg)] border border-[var(--border-strong)] px-4 text-[13px] font-bold text-[var(--fg)] disabled:opacity-40"
                >
                  추가
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <FieldLabel variant="profile">자기 소개</FieldLabel>
          </div>
          <textarea
            name="profileIntro"
            aria-label="자기 소개"
            value={intro}
            onChange={(event) => setIntro(event.target.value.slice(0, 300))}
            className="min-h-36 w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] p-4 text-[16px] leading-7 outline-none focus:border-[var(--accent)]"
            placeholder="본인 소개를 간략하게 작성해주세요."
          />
          <p className="mt-1 text-right text-[12px] text-[var(--fg-muted)]">
            {intro.length} / 300
          </p>
        </section>

        {isEnthusiast ? null : (
          <>
            <section>
              <FieldLabel variant="profile">
                메인으로 사용하는 에스프레소 머신 브랜드
              </FieldLabel>
              <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--border-strong)] p-3">
                <BrandFilterChips
                  options={ESPRESSO_MACHINE_BRAND_OPTIONS}
                  selected={espressoMachineBrands}
                  onToggle={(value) =>
                    setEspressoMachineBrands((current) =>
                      toggleStringSelection(current, value),
                    )
                  }
                  customValue={espressoMachineBrandInput}
                  customOpen={espressoMachineBrandInputOpen}
                  onCustomValueChange={setEspressoMachineBrandInput}
                  onCustomOpenChange={setEspressoMachineBrandInputOpen}
                  onAddCustom={(value) =>
                    setEspressoMachineBrands((current) =>
                      normalizeBrandSelections([...current, value]),
                    )
                  }
                  inputName="espressoMachineBrandCustom"
                  placeholder="머신 브랜드를 입력하세요."
                />
              </div>
            </section>

            <section>
              <FieldLabel variant="profile">
                메인으로 사용하는 메인 그라인더 브랜드
              </FieldLabel>
              <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--border-strong)] p-3">
                <BrandFilterChips
                  options={GRINDER_BRAND_OPTIONS}
                  selected={grinderBrands}
                  onToggle={(value) =>
                    setGrinderBrands((current) =>
                      toggleStringSelection(current, value),
                    )
                  }
                  customValue={grinderBrandInput}
                  customOpen={grinderBrandInputOpen}
                  onCustomValueChange={setGrinderBrandInput}
                  onCustomOpenChange={setGrinderBrandInputOpen}
                  onAddCustom={(value) =>
                    setGrinderBrands((current) =>
                      normalizeBrandSelections([...current, value]),
                    )
                  }
                  inputName="grinderBrandCustom"
                  placeholder="그라인더 브랜드를 입력하세요."
                />
              </div>
            </section>

            <section>
              <FieldLabel variant="profile">
                메인으로 사용하는 로스터기 브랜드
              </FieldLabel>
              <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--border-strong)] p-3">
                <BrandFilterChips
                  options={ROASTER_BRAND_OPTIONS}
                  selected={roasterBrands}
                  onToggle={(value) =>
                    setRoasterBrands((current) =>
                      toggleStringSelection(current, value),
                    )
                  }
                  customValue={roasterBrandInput}
                  customOpen={roasterBrandInputOpen}
                  onCustomValueChange={setRoasterBrandInput}
                  onCustomOpenChange={setRoasterBrandInputOpen}
                  onAddCustom={(value) =>
                    setRoasterBrands((current) =>
                      normalizeBrandSelections([...current, value]),
                    )
                  }
                  inputName="roasterBrandCustom"
                  placeholder="로스터기 브랜드를 입력하세요."
                />
              </div>
            </section>

            <section>
              <FieldLabel variant="profile">선호하는 원두</FieldLabel>
              <PreferredBeanChips
                beans={preferredBeans}
                value={preferredBeanInput}
                onValueChange={setPreferredBeanInput}
                onAdd={(bean) =>
                  setPreferredBeans((current) =>
                    parsePreferredBeans(
                      formatPreferredBeans([...current, bean]),
                    ),
                  )
                }
                onRemove={(bean) =>
                  setPreferredBeans((current) =>
                    current.filter((item) => item !== bean),
                  )
                }
              />
            </section>
          </>
        )}

        <section>
          <FieldLabel variant="profile">
            {isEnthusiast ? "선호 뉘앙스" : "선호하는 원두 뉘앙스"}
          </FieldLabel>
          <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--border-strong)] p-3">
            <FilterChips
              options={BEAN_NOTE_OPTIONS}
              selected={preferredBeanNotes}
              onToggle={(value) =>
                setPreferredBeanNotes((current) =>
                  toggleStringSelection(current, value),
                )
              }
            />
          </div>
        </section>

        <Divider />
        <section className="space-y-3">
          <FieldLabel variant="profile">소셜 미디어</FieldLabel>
          <TextInput
            prefixIcon={<InstagramBrandIcon className="h-6 w-6" />}
            placeholder="instagram.com/username"
            defaultValue={socials.instagram}
            onValueChange={(value) =>
              setSocials((current) => ({ ...current, instagram: value }))
            }
          />
          <TextInput
            prefixIcon={<ThreadsBrandIcon className="h-6 w-6" />}
            placeholder="threads.net/@username"
            defaultValue={socials.threads}
            onValueChange={(value) =>
              setSocials((current) => ({ ...current, threads: value }))
            }
          />
          <TextInput
            prefixIcon={<YoutubeBrandIcon className="h-6 w-6" />}
            placeholder="유튜브 주소 넣기"
            defaultValue={socials.website}
            onValueChange={(value) =>
              setSocials((current) => ({ ...current, website: value }))
            }
          />
        </section>
        {error ? (
          <p className="ds-body-s ds-danger font-bold">{error}</p>
        ) : null}
      </section>
      {postcodeSearchOpen ? null : (
        <div className="sticky bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)] px-6 pb-[calc(var(--app-safe-area-bottom)+12px)] pt-3">
          <Button
            type="button"
            disabled={!canSave || saving}
            onClick={saveProfile}
          >
            {saving ? "수정 중..." : "수정하기"}
          </Button>
          {!canSave ? (
            <p className="ds-body-s ds-muted mt-2 text-center">
              {isEnthusiast
                ? "성명과 닉네임을 입력하면 저장할 수 있어요."
                : "성명, 닉네임, 전문 분야, 소속 매장을 입력하면 저장할 수 있어요."}
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}

function WorkplaceSearchInput({
  name,
  label,
  storeLabel,
  addressLabel,
  value,
  selectedLocation,
  disabled,
  onChange,
  onSelect,
  onRemove,
  removable,
  employmentTypes,
  onEmploymentTypesChange,
  onSearchOpenChange,
}: {
  name: string;
  label: string;
  storeLabel?: string;
  addressLabel?: string;
  value: string;
  selectedLocation?: WorkplaceLocation;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSelect?: (location: WorkplaceLocation) => void;
  onRemove?: () => void;
  removable?: boolean;
  employmentTypes?: string[];
  onEmploymentTypesChange?: (types: string[]) => void;
  onSearchOpenChange?: (open: boolean) => void;
}) {
  const postalCode = selectedLocation?.postalCode ?? "";
  const baseAddress = selectedLocation?.address ?? "";
  const detailAddress = selectedLocation?.detailAddress ?? "";

  useEffect(
    () => () => {
      onSearchOpenChange?.(false);
    },
    [onSearchOpenChange],
  );

  const handlePostcodeComplete = useCallback(
    ({ data, address }: PostcodeSelection) => {
      const nextName = value.trim() || data.buildingName.trim() || address;
      const location: WorkplaceLocation = {
        id: `postcode-${data.zonecode}-${address.replace(/\s+/g, "-")}`,
        name: nextName,
        address,
        postalCode: data.zonecode,
        lat: 0,
        lng: 0,
        displayName: locationDisplayName(nextName, address),
      };
      onChange(nextName);
      onSelect?.(withWorkplaceName(location, nextName));
    },
    [onChange, onSelect, value],
  );

  const updateSelectedLocation = (patch: Partial<WorkplaceLocation>) => {
    if (!selectedLocation) return;
    onSelect?.(withWorkplaceName({ ...selectedLocation, ...patch }, value));
  };

  return (
    <div>
      <div className="grid gap-5">
        <label className="block">
          <FieldLabel variant="profile">
            {storeLabel ?? `${label} 상호명`}
          </FieldLabel>
          <div className="mt-2 flex items-center gap-2">
            <input
              name={name}
              aria-label={`${label} 상호명`}
              disabled={disabled}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder="상호명을 입력하세요"
              className="h-12 min-w-0 flex-1 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-transparent px-4 text-[16px] outline-none placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent)] disabled:cursor-not-allowed"
            />
            {onRemove && removable ? (
              <button
                type="button"
                aria-label={`${label} 삭제`}
                disabled={disabled}
                onClick={onRemove}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-strong)] text-[var(--fg-muted)] disabled:opacity-30"
              >
                <X size={18} />
              </button>
            ) : null}
          </div>
        </label>
        <section>
          <FieldLabel variant="profile">
            {addressLabel ?? `${label} 주소`}
          </FieldLabel>
          <div className="mt-2">
            <PostcodeSearchField
              ariaLabel={`${label} 주소 검색`}
              postalCode={postalCode}
              baseAddress={baseAddress}
              detailAddress={detailAddress}
              disabled={disabled}
              onComplete={handlePostcodeComplete}
              onDetailAddressChange={(detailAddress) =>
                updateSelectedLocation({ detailAddress })
              }
              onSearchOpenChange={onSearchOpenChange}
            />
          </div>
        </section>
        {employmentTypes && onEmploymentTypesChange ? (
          <section>
            <FieldLabel variant="profile">근무 형태</FieldLabel>
            <div className="mt-3">
              <FilterChips
                options={EMPLOYMENT_TYPE_OPTIONS}
                selected={employmentTypes}
                onToggle={(type) =>
                  onEmploymentTypesChange(
                    toggleStringSelection(employmentTypes, type),
                  )
                }
              />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

type CareerDraftType = "career" | "award";

export function getCareerEditMode(type: string | null): {
  type: CareerDraftType;
  title: string;
} {
  return type === "award"
    ? { type: "award", title: "수상 추가" }
    : { type: "career", title: "경력 추가" };
}

function CareerEditScreen({ careers }: { careers: CareerItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = getCareerEditMode(searchParams.get("type"));
  const [item, setItem] = useState(() => ({
    id: crypto.randomUUID(),
    type: mode.type,
    year: "",
    title: "",
    organization: "",
    detail: "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateItem = (patch: Partial<typeof item>) => {
    setError(null);
    setItem((current) => ({ ...current, ...patch }));
  };

  const { startYear, endYear } = careerPeriodYears(item.year);
  const isCurrent = item.year.includes("현재");

  const updateCareerPeriod = (
    nextStartYear: string,
    nextEndYear: string,
    current: boolean,
  ) => {
    updateItem({
      year: nextStartYear
        ? `${nextStartYear} ~ ${current ? "현재" : nextEndYear}`
        : "",
    });
  };

  const validationMessage = validateCareerDrafts([item]);
  const requiredFieldsComplete = hasCompleteCareerRequiredFields([item]);

  const saveCareers = async () => {
    if (saving) return;
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const existingItems = careers.map((career) => ({
        id: career.id,
        type: career.type,
        year: career.year,
        period: career.period || career.year,
        title: career.title,
        organization: career.organization ?? "",
        detail: career.detail ?? career.description ?? "",
      }));
      await updateMemberCareers([
        ...existingItems,
        {
          id: item.id,
          type: item.type,
          year: item.year.trim(),
          period: item.year.trim(),
          title: item.title.trim(),
          organization: item.organization.trim(),
          detail: item.detail.trim(),
        },
      ]);
      window.location.assign("/home");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "이력 저장에 실패했습니다.",
      );
      setSaving(false);
    }
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 mx-auto max-w-[var(--app-shell-max-width)] border-b border-[var(--border)] bg-[var(--surface)]/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="grid h-16 grid-cols-[56px_1fr_56px] items-center px-2">
          <button
            type="button"
            aria-label="닫기"
            onClick={() => {
              if (window.history.length > 1) router.back();
              else router.push("/home");
            }}
            className="flex h-11 w-11 items-center justify-center text-[var(--fg-muted)]"
          >
            <X size={20} strokeWidth={2.2} />
          </button>
          <h1 className="text-center text-[18px] font-bold text-[var(--fg-strong)]">
            {mode.title}
          </h1>
          <button
            type="button"
            disabled={!requiredFieldsComplete || saving}
            onClick={() => void saveCareers()}
            className="flex h-11 w-14 items-center justify-center text-[14px] font-bold text-[var(--accent)] disabled:opacity-40"
          >
            {saving ? "저장 중" : "저장"}
          </button>
        </div>
      </header>

      <main className="min-h-screen bg-[var(--bg)] px-4 pb-10 pt-[calc(64px+env(safe-area-inset-top)+20px)]">
        {item.type === "career" ? (
          <div className="space-y-6">
            <label className="block">
              <FieldLabel variant="profile">
                직무 / 역할 <span className="text-[var(--accent)]">*</span>
              </FieldLabel>
              <input
                name="careerTitle"
                value={item.title}
                onChange={(event) => updateItem({ title: event.target.value })}
                placeholder="예: 대표 바리스타, 헤드바리스타"
                className="mt-3 h-12 w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-[16px] outline-none placeholder:text-[var(--fg-faint)] focus:border-[var(--accent)]"
              />
            </label>

            <label className="block">
              <FieldLabel variant="profile">
                소속 (카페·브랜드명){" "}
                <span className="text-[var(--accent)]">*</span>
              </FieldLabel>
              <input
                name="careerOrganization"
                value={item.organization}
                onChange={(event) =>
                  updateItem({ organization: event.target.value })
                }
                placeholder="예: OO 로스터리"
                className="mt-3 h-12 w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-[16px] outline-none placeholder:text-[var(--fg-faint)] focus:border-[var(--accent)]"
              />
            </label>

            <section>
              <FieldLabel variant="profile">
                근무 기간 <span className="text-[var(--accent)]">*</span>
              </FieldLabel>
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <CareerYearSelect
                  name="careerStartYear"
                  value={startYear}
                  onChange={(event) =>
                    updateCareerPeriod(
                      event.target.value,
                      isCurrent ? "" : endYear,
                      isCurrent,
                    )
                  }
                />
                <span className="text-[16px] font-bold text-[var(--fg-muted)]">
                  ~
                </span>
                <CareerYearSelect
                  name="careerEndYear"
                  value={isCurrent ? "" : endYear}
                  placeholder="종료연도"
                  onChange={(event) =>
                    updateCareerPeriod(startYear, event.target.value, false)
                  }
                />
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isCurrent}
                onClick={() =>
                  updateCareerPeriod(
                    startYear,
                    isCurrent ? "" : endYear,
                    !isCurrent,
                  )
                }
                className={cn(
                  "mt-3 flex h-11 w-full items-center justify-between rounded-[var(--radius-lg)] border border-[var(--border)] px-4 text-[13px] font-bold",
                  isCurrent
                    ? "bg-[var(--surface)] text-[var(--fg)]"
                    : "bg-[var(--surface-alt)] text-[var(--fg-muted)]",
                )}
              >
                <span>현재 재직 중이에요</span>
                <span
                  className={cn(
                    "flex h-6 w-11 items-center rounded-[var(--radius-pill)] p-1 transition-colors",
                    isCurrent
                      ? "justify-end bg-[var(--accent)]"
                      : "justify-start bg-[var(--fg-faint)]",
                  )}
                >
                  <span className="h-4 w-4 rounded-[var(--radius-pill)] bg-[var(--surface)]" />
                </span>
              </button>
              <p className="mt-2 text-[11px] text-[var(--fg-subtle)]">
                재직 중이면 종료 연도 대신 현재로 저장됩니다.
              </p>
            </section>

            <label className="block">
              <FieldLabel variant="profile">주요 업무 (선택)</FieldLabel>
              <textarea
                name="careerDetail"
                value={item.detail}
                onChange={(event) =>
                  updateItem({
                    detail: event.target.value.slice(0, 100),
                  })
                }
                placeholder="예: 브루잉 총괄 및 신메뉴 개발 담당"
                className="mt-3 min-h-32 w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] p-4 text-[16px] leading-7 outline-none placeholder:text-[var(--fg-faint)] focus:border-[var(--accent)]"
              />
            </label>
          </div>
        ) : (
          <div className="space-y-6">
            <label className="block">
              <FieldLabel variant="profile">
                수상명 <span className="text-[var(--accent)]">*</span>
              </FieldLabel>
              <input
                name="awardTitle"
                value={item.title}
                onChange={(event) => updateItem({ title: event.target.value })}
                placeholder="예: 브루잉 부문 1위"
                className="mt-3 h-12 w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-[16px] outline-none placeholder:text-[var(--fg-faint)] focus:border-[var(--accent)]"
              />
            </label>

            <label className="block">
              <FieldLabel variant="profile">
                주최 기관 <span className="text-[var(--accent)]">*</span>
              </FieldLabel>
              <input
                name="awardOrganization"
                value={item.organization}
                onChange={(event) =>
                  updateItem({ organization: event.target.value })
                }
                placeholder="예: 한국커피협회"
                className="mt-3 h-12 w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-[16px] outline-none placeholder:text-[var(--fg-faint)] focus:border-[var(--accent)]"
              />
            </label>

            <label className="block">
              <FieldLabel variant="profile">
                수상 연도 <span className="text-[var(--accent)]">*</span>
              </FieldLabel>
              <div className="mt-3">
                <CareerYearSelect
                  name="awardYear"
                  value={startYear}
                  onChange={(event) => updateItem({ year: event.target.value })}
                />
              </div>
              <p className="mt-2 text-[11px] text-[var(--fg-subtle)]">
                수상한 시점의 연도 하나만 선택해 주세요.
              </p>
            </label>

            <label className="block">
              <FieldLabel variant="profile">
                대회·행사명 / 비고 (선택)
              </FieldLabel>
              <textarea
                name="awardDetail"
                value={item.detail}
                onChange={(event) =>
                  updateItem({ detail: event.target.value.slice(0, 100) })
                }
                placeholder="예: 제23회 대한민국 커피대전"
                className="mt-3 min-h-32 w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] p-4 text-[16px] leading-7 outline-none placeholder:text-[var(--fg-faint)] focus:border-[var(--accent)]"
              />
            </label>
          </div>
        )}

        {error ? (
          <p className="mt-5 text-[13px] font-bold text-[var(--accent)]">
            {error}
          </p>
        ) : null}
      </main>
    </>
  );
}

function CareerYearSelect({
  name,
  value,
  placeholder = "YYYY",
  onChange,
}: {
  name: string;
  value: string;
  placeholder?: string;
  onChange: ChangeEventHandler<HTMLSelectElement>;
}) {
  return (
    <div className="relative min-w-0">
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="h-14 w-full appearance-none rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 pr-11 text-[16px] outline-none focus:border-[var(--accent)]"
      >
        <option value="">{placeholder}</option>
        {CAREER_YEAR_OPTIONS.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
      <ChevronDown
        size={20}
        strokeWidth={2}
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--fg)]"
      />
    </div>
  );
}

function PortfolioDetailScreen({
  portfolio,
  isOwnProfile,
}: {
  portfolio: PortfolioItem;
  isOwnProfile: boolean;
}) {
  useLayoutEffect(() => {
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
    window.scrollTo({ left: 0, top: 0, behavior: "auto" });
  }, [portfolio.id]);

  return (
    <>
      <HomeSubHeader
        title="포트폴리오 상세"
        right={
          isOwnProfile ? <PortfolioActionsMenu portfolio={portfolio} /> : null
        }
      />
      <div className="min-h-screen overflow-x-hidden bg-[var(--bg)]">
        <section className="px-6 py-6">
          <ImageDetailSlider images={portfolio.imageUrls} />
          <div className="mt-10 text-center">
            <h1 className="text-[16px] font-bold leading-[1.35] tracking-[-0.01em] text-[var(--fg-strong)]">
              {portfolio.title}
            </h1>
            <p className="mt-2 text-[13px] leading-[1.5] text-[var(--fg-muted)]">
              {portfolio.createdAt}
            </p>
          </div>
          <p className="mt-10 whitespace-pre-line rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 text-[12px] leading-6 text-[var(--fg)]">
            {portfolio.summary.slice(0, 500)}
          </p>
        </section>
      </div>
    </>
  );
}

function PortfolioWriteScreen({ portfolio }: { portfolio?: PortfolioItem }) {
  type PortfolioAttachedImage = Omit<AttachedImage, "file"> & { file?: File };

  const createExistingPortfolioImage = (
    url: string,
    index: number,
  ): PortfolioAttachedImage => ({
    id: `existing-${index}-${url}`,
    name: `이미지 ${index + 1}`,
    size: 0,
    url,
  });
  const [attachedImages, setAttachedImages] = useState<
    PortfolioAttachedImage[]
  >(() => (portfolio?.imageUrls ?? []).map(createExistingPortfolioImage));
  const imagesRef = useRef<PortfolioAttachedImage[]>([]);
  const [projectTitle, setProjectTitle] = useState(portfolio?.title ?? "");
  const [body, setBody] = useState(portfolio?.summary ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { startImageCrop, imageCropEditor } = useImageCropFlow((files) => {
    setAttachedImages((current) => [
      ...current,
      ...files.map(createAttachedImage),
    ]);
  });
  const [createdAt] = useState(() => {
    if (portfolio?.createdAt) return portfolio.createdAt;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
  });

  useEffect(() => {
    imagesRef.current = attachedImages;
  }, [attachedImages]);

  useEffect(
    () => () =>
      imagesRef.current.forEach((image) => {
        if (image.file) URL.revokeObjectURL(image.url);
      }),
    [],
  );

  const attachImageFiles = (files: File[]) => {
    if (files.length === 0) return;

    const remaining = PORTFOLIO_IMAGE_ATTACHMENT_LIMIT - attachedImages.length;
    if (remaining <= 0) {
      window.alert(
        `이미지는 최대 ${PORTFOLIO_IMAGE_ATTACHMENT_LIMIT}장까지 첨부할 수 있습니다.`,
      );
      return;
    }

    if (files.length > remaining) {
      window.alert(`이미지는 ${remaining}장만 더 첨부할 수 있습니다.`);
    }

    const validFiles = filterImageFiles(
      files.slice(0, remaining),
      PORTFOLIO_IMAGE_LIMIT,
    );
    startImageCrop(validFiles);
  };

  const attachImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    attachImageFiles(files);
  };

  const openNativeImagePicker = isNativeImagePickerAvailable()
    ? async () => {
        try {
          const remaining =
            PORTFOLIO_IMAGE_ATTACHMENT_LIMIT - attachedImages.length;
          const files = await pickNativeImageFiles(remaining);
          attachImageFiles(files ?? []);
        } catch {
          window.alert("이미지 선택에 실패했습니다. 다시 시도해주세요.");
        }
      }
    : undefined;

  const canSubmit =
    projectTitle.trim().length > 0 &&
    body.trim().length > 0 &&
    attachedImages.length > 0;

  const submitPortfolio = async () => {
    if (!canSubmit || saving) return;

    setSaving(true);
    setError(null);
    try {
      const uploadedImageUrls =
        attachedImages.length > 0
          ? await uploadImages(
              attachedImages.flatMap((image) =>
                image.file ? [image.file] : [],
              ),
              "members/portfolio",
            )
          : [];
      const imageUrls = [
        ...attachedImages.flatMap((image) => (image.file ? [] : [image.url])),
        ...uploadedImageUrls,
      ].slice(0, PORTFOLIO_IMAGE_ATTACHMENT_LIMIT);
      const input = {
        title: projectTitle.trim(),
        summary: body.trim(),
        imageUrls,
      };
      const savedPortfolio = portfolio
        ? await updatePortfolio(portfolio.id, input)
        : await createPortfolio(input);
      window.location.replace(`/home/portfolio/${savedPortfolio.id}`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : `포트폴리오 ${portfolio ? "수정" : "등록"}에 실패했습니다.`,
      );
      setSaving(false);
    }
  };

  return (
    <>
      {imageCropEditor}
      <HomeSubHeader title="포트폴리오 관리" />
      <section className="space-y-6 px-6 py-6 pb-[calc(var(--app-safe-area-bottom)+120px)]">
        <ImageAttachmentSection
          title="포트폴리오 이미지"
          images={attachedImages}
          limit={PORTFOLIO_IMAGE_ATTACHMENT_LIMIT}
          accept={IMAGE_ACCEPT}
          inputName="portfolioImages"
          ariaPrefix="포트폴리오"
          onAttachImages={attachImages}
          onOpenNativePicker={openNativeImagePicker}
          onRemoveImage={(image) => {
            if (image.file) URL.revokeObjectURL(image.url);
            setAttachedImages((current) =>
              current.filter((item) => item.id !== image.id),
            );
          }}
        />
        <label className="block">
          <FieldLabel variant="profile">포트폴리오 이름 *</FieldLabel>
          <input
            name="portfolioTitle"
            value={projectTitle}
            onChange={(event) => setProjectTitle(event.target.value)}
            placeholder="제목을 입력하세요"
            className="mt-3 h-14 w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-5 text-[16px] outline-none placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)]"
          />
        </label>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-alt)] px-4 py-3 text-[14px] text-[var(--fg-muted)]">
          생성 일시:{" "}
          <span className="font-bold text-[var(--fg)]">{createdAt}</span>
        </div>
        <div>
          <textarea
            name="portfolioBody"
            aria-label="포트폴리오 설명"
            value={body}
            onChange={(event) => setBody(event.target.value.slice(0, 500))}
            placeholder="예: 에티오피아 내추럴 원두로 완성한 시그니처 메뉴 기록입니다."
            className="min-h-72 w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] p-5 text-[16px] leading-8 outline-none placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent)]"
          />
          <p
            className={cn(
              "mt-2 text-right text-[13px]",
              body.length >= 500
                ? "text-[var(--accent)]"
                : "text-[var(--fg-muted)]",
            )}
          >
            {body.length} / 500
          </p>
        </div>
        {error ? (
          <p className="ds-body-s ds-danger font-bold">{error}</p>
        ) : null}
      </section>
      <div className="sticky bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)] px-6 pb-[calc(var(--app-safe-area-bottom)+12px)] pt-3">
        <Button
          type="button"
          disabled={!canSubmit || saving}
          onClick={submitPortfolio}
        >
          {saving
            ? portfolio
              ? "수정 중..."
              : "등록 중..."
            : portfolio
              ? "수정하기"
              : "등록하기"}
        </Button>
      </div>
    </>
  );
}

function SignupTypeScreen() {
  const selectedRole = useMemberStore((state) => state.selectedSignupRole);
  const setSelectedSignupRole = useMemberStore(
    (state) => state.setSelectedSignupRole,
  );

  return (
    <div className="member-slide-page min-h-screen bg-[var(--bg)]">
      <SignupHeader />
      <section className="px-6 pb-44 pt-10">
        <h1 className="ds-display-m text-center">
          어떤 유형으로 가입하시겠어요?
        </h1>
        <p className="ds-body-l ds-muted mt-4 text-center">
          회원 유형에 따라 맞춤화된 기능을 제공합니다.
        </p>
        <div className="mt-8 space-y-4">
          <RoleCard
            selected={selectedRole === "barista"}
            title="바리스타"
            description="커피 전문 지식을 공유하고 커리어를 관리하고 싶다면"
            imageSrc="https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=900&q=80"
            imageAlt="에스프레소 머신 앞에서 커피를 준비하는 바리스타"
            onClick={() => setSelectedSignupRole("barista")}
          />
          <RoleCard
            selected={selectedRole === "enthusiast"}
            title="커피애호가"
            description="다양한 카페 정보를 탐색하고 커피 문화를 즐기고 싶다면"
            imageSrc="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80"
            imageAlt="테이블 위에 놓인 커피잔과 카페 장면"
            onClick={() => setSelectedSignupRole("enthusiast")}
          />
          <RoleCard
            selected={selectedRole === "partner"}
            title="파트너"
            description="장비, 원두, 서비스 제안을 바리스타에게 소개하고 싶다면"
            imageSrc="https://images.unsplash.com/photo-1517231925375-bf2cb42917a5?auto=format&fit=crop&w=900&q=80"
            imageAlt="카페 바에서 비즈니스 상담을 나누는 사람들"
            onClick={() => setSelectedSignupRole("partner")}
          />
        </div>
      </section>
      <SignupBottomBar>
        <p className="ds-body mb-5 text-center ds-muted">
          이미 계정이 있으신가요?{" "}
          <Link prefetch={false} href="/login" className="ds-inline-link">
            로그인
          </Link>
        </p>
        <LinkButton href="/signup/phone" prefetch={false}>
          다음 단계로
        </LinkButton>
      </SignupBottomBar>
    </div>
  );
}

function SignupPhoneScreen() {
  const router = useRouter();
  const phone = useMemberStore((state) => state.signupPhone);
  const setSignupPhone = useMemberStore((state) => state.setSignupPhone);
  const clearSignupCode = useMemberStore((state) => state.clearSignupCode);
  const setSignupDevCode = useMemberStore((state) => state.setSignupDevCode);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const canSend = phone.replace(/\D/g, "").length === 11;

  const submitPhone = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend || sending) return;

    setSending(true);
    setError(null);

    try {
      const result = await requestPhoneVerification(phone);
      setSignupDevCode(result.code);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "인증번호 전송에 실패했습니다.",
      );
      setSending(false);
      return;
    }

    clearSignupCode();
    router.push("/signup/verify");
  };

  return (
    <div className="member-slide-page min-h-screen bg-[var(--bg)]">
      <SignupHeader />
      <form onSubmit={submitPhone} className="px-6 pb-36 pt-12">
        <StepBar active={1} />
        <h1 className="ds-display-m mt-16">
          인증을 위해 휴대폰 번호를 입력해 주세요
        </h1>
        <div className="mt-14">
          <FieldLabel caps>MOBILE NUMBER</FieldLabel>
          <Input
            name="mobileNumber"
            aria-label="휴대폰 번호"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(event) =>
              setSignupPhone(formatPhoneNumber(event.target.value))
            }
            className="mt-3"
            placeholder="010-0000-0000"
          />
          {error ? (
            <p className="ds-body-s ds-danger mt-3 font-bold">{error}</p>
          ) : null}
          <p className="ds-body-l ds-muted mt-4">
            입력하신 번호로 인증번호가 발송됩니다.
          </p>
        </div>
        <SignupBottomBar>
          <Button type="submit" disabled={!canSend || sending}>
            {sending ? "전송 중..." : "인증번호 전송"}
          </Button>
          <p className="ds-body mt-6 text-center ds-muted">
            이미 계정이 있으신가요?{" "}
            <Link prefetch={false} href="/login" className="ds-inline-link">
              로그인
            </Link>
          </p>
        </SignupBottomBar>
      </form>
    </div>
  );
}

function SignupVerifyScreen() {
  const router = useRouter();
  const phone = useMemberStore((state) => state.signupPhone);
  const code = useMemberStore((state) => state.signupCode);
  const devCode = useMemberStore((state) => state.signupDevCode);
  const setSignupCodeDigit = useMemberStore(
    (state) => state.setSignupCodeDigit,
  );
  const setSignupCode = useMemberStore((state) => state.setSignupCode);
  const clearSignupCode = useMemberStore((state) => state.clearSignupCode);
  const setSignupVerificationToken = useMemberStore(
    (state) => state.setSignupVerificationToken,
  );
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const [remainingSeconds, setRemainingSeconds] = useState(180);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const expired = remainingSeconds <= 0;
  const canContinue = !expired && code.every((digit) => digit.length === 1);

  useEffect(() => {
    if (expired) return;

    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [expired]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  };

  const changeCode = (index: number, value: string) => {
    const digits = value.replace(/\D/g, "");

    if (digits.length > 1) {
      const nextCode = [...code];
      digits
        .slice(0, code.length - index)
        .split("")
        .forEach((digit, offset) => {
          nextCode[index + offset] = digit;
        });
      setSignupCode(nextCode);

      const nextIndex = Math.min(index + digits.length, code.length - 1);
      inputsRef.current[nextIndex]?.focus();
      setError(null);
      return;
    }

    const nextValue = digits.slice(-1);
    setSignupCodeDigit(index, nextValue);

    if (nextValue && index < code.length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
    setError(null);
  };

  const handleCodeKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const resendCode = async () => {
    clearSignupCode();
    setRemainingSeconds(180);
    setError(null);
    try {
      const result = await requestPhoneVerification(phone);
      useMemberStore.getState().setSignupDevCode(result.code);
      window.requestAnimationFrame(() => inputsRef.current[0]?.focus());
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "인증번호 재전송에 실패했습니다.",
      );
    }
  };

  const submitCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canContinue || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await confirmPhoneVerification(phone, code.join(""));
      setSignupVerificationToken(result.verificationToken);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "인증번호 확인에 실패했습니다.",
      );
      setSubmitting(false);
      return;
    }

    router.push("/signup/details");
  };

  return (
    <div className="member-slide-page min-h-screen bg-[var(--bg)]">
      <SignupHeader />
      <form onSubmit={submitCode} className="px-6 pb-36 pt-12">
        <StepBar active={2} />
        <h1 className="ds-display-m mt-16">전송된 인증번호</h1>
        <p className="ds-body-l ds-muted mt-4">
          입력하신 휴대폰 번호로 전송된 인증번호 6자리를 입력해주세요.
        </p>
        {devCode ? (
          <p className="ds-body-s mt-4 rounded-[var(--radius-md)] bg-[var(--surface-alt)] px-4 py-3 font-bold text-[var(--fg-muted)]">
            개발 모드 인증번호: {devCode}
          </p>
        ) : null}
        <div className="mt-14 grid grid-cols-6 gap-3">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputsRef.current[index] = element;
              }}
              name={`verificationCode${index + 1}`}
              aria-label={`인증번호 ${index + 1}번째 자리`}
              value={digit}
              onChange={(event) => changeCode(index, event.target.value)}
              onKeyDown={(event) => handleCodeKeyDown(index, event)}
              maxLength={code.length - index}
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              disabled={expired}
              className="ds-display-m h-20 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] text-center outline-none placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)] disabled:bg-[var(--surface-alt)] disabled:text-[var(--fg-faint)]"
              placeholder="-"
            />
          ))}
        </div>
        <div className="mt-8 text-center">
          <p className="ds-h2 ds-accent flex items-center justify-center gap-2">
            <Clock3 size={20} /> {formatTime(remainingSeconds)}
          </p>
          <button
            type="button"
            onClick={resendCode}
            className="ds-body-l ds-muted mt-3 underline underline-offset-4"
          >
            문자 재전송
          </button>
          {expired ? (
            <p className="ds-body-s ds-danger mt-3 font-bold">
              인증 시간이 만료되었습니다. 문자를 다시 전송해주세요.
            </p>
          ) : null}
          {error ? (
            <p className="ds-body-s ds-danger mt-3 font-bold">{error}</p>
          ) : null}
        </div>
        <div className="ds-body ds-muted mt-12 flex gap-4 rounded-[var(--radius-lg)] border border-[var(--border-strong)] p-5">
          <Info size={22} className="mt-1 shrink-0" />
          인증번호가 오지 않는다면 통신사 스팸 차단 서비스 또는 휴대폰의 스팸
          메시지함을 확인해 주세요.
        </div>
        <SignupBottomBar>
          <Button type="submit" disabled={!canContinue || submitting}>
            {submitting ? "확인 중..." : "다음"}
          </Button>
        </SignupBottomBar>
      </form>
    </div>
  );
}

function SignupDetailsScreen() {
  const selectedRole = useMemberStore((state) => state.selectedSignupRole);
  const signupPhone = useMemberStore((state) => state.signupPhone);
  const signupVerificationToken = useMemberStore(
    (state) => state.signupVerificationToken,
  );
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [startingBusiness, setStartingBusiness] = useState(false);
  const [workplaces, setWorkplaces] = useState([""]);
  const [workplaceLocations, setWorkplaceLocations] = useState<
    Array<WorkplaceLocation | null>
  >([null]);
  const [gender, setGender] = useState<"male" | "female">("male");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const passwordMismatch =
    passwordConfirm.length > 0 && password !== passwordConfirm;
  const hasWorkplace =
    startingBusiness ||
    workplaceLocations.some(
      (location, index) => Boolean(location) && workplaces[index]?.trim(),
    );
  const canComplete =
    name.trim().length > 0 &&
    password.length >= 8 &&
    passwordConfirm.length >= 8 &&
    !passwordMismatch &&
    hasWorkplace &&
    birthYear.length > 0 &&
    birthMonth.length > 0 &&
    birthDay.length > 0 &&
    termsAccepted;

  const updateWorkplace = (index: number, value: string) => {
    setWorkplaces((current) =>
      current.map((workplace, workplaceIndex) =>
        workplaceIndex === index ? value : workplace,
      ),
    );
    setWorkplaceLocations((current) =>
      current.map((location, locationIndex) =>
        locationIndex === index && location
          ? withWorkplaceName(location, value)
          : location,
      ),
    );
  };

  const selectWorkplace = (index: number, location: WorkplaceLocation) => {
    const workplaceName =
      workplaces[index]?.trim() ||
      (location.name === location.address ? "" : location.name);
    setWorkplaces((current) =>
      current.map((workplace, workplaceIndex) =>
        workplaceIndex === index ? workplaceName : workplace,
      ),
    );
    setWorkplaceLocations((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? withWorkplaceName(location, workplaceName) : item,
      ),
    );
  };

  const addWorkplace = () => {
    setWorkplaces((current) => {
      if (current.length >= 3) return current;
      setWorkplaceLocations((locations) => [...locations, null]);
      return [...current, ""];
    });
  };

  const removeWorkplace = (index: number) => {
    setWorkplaces((current) => {
      const next = current.filter(
        (_, workplaceIndex) => workplaceIndex !== index,
      );
      return next.length > 0 ? next : [""];
    });
    setWorkplaceLocations((current) => {
      const next = current.filter(
        (_, locationIndex) => locationIndex !== index,
      );
      return next.length > 0 ? next : [null];
    });
  };

  const submitDetails = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canComplete || submitting) return;
    if (!signupVerificationToken) {
      setError("휴대폰 인증을 먼저 완료해주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const namedLocations = workplaceLocations.flatMap((location, index) =>
        location && workplaces[index]?.trim()
          ? [withWorkplaceName(location, workplaces[index])]
          : [],
      );
      await registerWithPhone({
        role: selectedRole,
        phone: signupPhone,
        name: name.trim(),
        password,
        phoneVerificationToken: signupVerificationToken,
        workplaces: startingBusiness
          ? []
          : namedLocations.map((location) => location.name),
        workplaceLocations: startingBusiness ? [] : namedLocations,
        termsAccepted,
      });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "회원가입에 실패했습니다.",
      );
      setSubmitting(false);
      return;
    }

    window.location.assign("/home");
  };

  return (
    <div className="member-slide-page min-h-screen bg-[var(--bg)]">
      <SignupHeader />
      <form onSubmit={submitDetails} className="space-y-8 px-6 pb-36 pt-10">
        <StepBar active={3} />
        <div>
          <h1 className="ds-display-m">추가 정보를 입력해 주세요</h1>
          <p className="ds-body-l ds-muted mt-3">
            바리스타 활동을 위한 필수 정보를 입력하는 단계입니다.
          </p>
          {error ? (
            <p className="ds-body-s ds-danger mt-4 font-bold">{error}</p>
          ) : null}
        </div>
        <SignupInput
          label="이름"
          value={name}
          onChange={setName}
          placeholder="성함을 입력하세요"
          autoComplete="name"
        />
        <SignupInput
          label="비밀번호"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="8자리 이상 입력하세요"
          autoComplete="new-password"
        />
        <div>
          <SignupInput
            label="비밀번호 확인"
            type="password"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            placeholder="비밀번호를 한번 더 입력하세요"
            autoComplete="new-password"
          />
          <TermsConsentCheckbox
            checked={termsAccepted}
            onChange={setTermsAccepted}
          />
          {passwordMismatch ? (
            <p className="ds-body-s ds-danger mt-2 font-bold">
              비밀번호가 일치하지 않습니다.
            </p>
          ) : null}
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-strong)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="ds-h3">소속 관리</h2>
            <button
              type="button"
              onClick={() => setStartingBusiness((current) => !current)}
              className="ds-body flex items-center gap-3"
              aria-pressed={startingBusiness}
            >
              창업준비중
              <span
                className={cn(
                  "flex h-8 w-14 items-center rounded-[var(--radius-pill)] p-1 transition-colors",
                  startingBusiness
                    ? "justify-end bg-[var(--fg)]"
                    : "justify-start bg-[var(--fg-muted)]",
                )}
              >
                <span className="h-6 w-6 rounded-[var(--radius-pill)] bg-[var(--surface)]" />
              </span>
            </button>
          </div>
          <div
            className={cn(
              "space-y-3",
              startingBusiness && "pointer-events-none opacity-40",
            )}
          >
            {workplaces.map((workplace, index) => (
              <WorkplaceSearchInput
                key={index}
                name={`workplace-${index + 1}`}
                label={`소속 ${index + 1}`}
                value={workplace}
                selectedLocation={workplaceLocations[index] ?? undefined}
                disabled={startingBusiness}
                onChange={(value) => updateWorkplace(index, value)}
                onSelect={(location) => selectWorkplace(index, location)}
                onRemove={() => removeWorkplace(index)}
                removable={workplaces.length > 1}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={startingBusiness || workplaces.length >= 3}
            onClick={addWorkplace}
            className="mt-4 min-h-12 border-dashed py-0 disabled:border-[var(--fg-faint)]"
          >
            <Plus size={22} /> 소속 추가{" "}
            <span className="ds-body ds-muted">({workplaces.length}/3)</span>
          </Button>
        </div>
        <section>
          <FieldLabel>성별</FieldLabel>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="base"
              onClick={() => setGender("male")}
              className={cn(
                "min-h-14 py-0",
                gender === "male"
                  ? "border border-[var(--fg)] bg-[var(--fg)] text-[var(--surface)] shadow-none"
                  : "ds-btn-secondary",
              )}
            >
              남
            </Button>
            <Button
              type="button"
              variant="base"
              onClick={() => setGender("female")}
              className={cn(
                "min-h-14 py-0",
                gender === "female"
                  ? "border border-[var(--fg)] bg-[var(--fg)] text-[var(--surface)] shadow-none"
                  : "ds-btn-secondary",
              )}
            >
              여
            </Button>
          </div>
        </section>
        <section>
          <FieldLabel>생년월일</FieldLabel>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <SignupSelect
              label="년"
              value={birthYear}
              onChange={setBirthYear}
              placeholder="년(YYYY)"
              options={Array.from({ length: 61 }, (_, index) =>
                String(new Date().getFullYear() - 14 - index),
              )}
            />
            <SignupSelect
              label="월"
              value={birthMonth}
              onChange={setBirthMonth}
              placeholder="월(MM)"
              options={Array.from({ length: 12 }, (_, index) =>
                String(index + 1).padStart(2, "0"),
              )}
            />
            <SignupSelect
              label="일"
              value={birthDay}
              onChange={setBirthDay}
              placeholder="일(DD)"
              options={Array.from({ length: 31 }, (_, index) =>
                String(index + 1).padStart(2, "0"),
              )}
            />
          </div>
        </section>
        <SignupBottomBar>
          <Button type="submit" disabled={!canComplete || submitting}>
            {submitting ? "가입 중..." : "완료!"}
          </Button>
        </SignupBottomBar>
      </form>
    </div>
  );
}

function SignupHeader() {
  return <ScreenHeader title="회원가입" back />;
}

function SignupBottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[var(--app-shell-max-width)] border-t border-[var(--border)] bg-[var(--surface)] px-6 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4">
      {children}
    </div>
  );
}

function SignupInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: "text" | "password";
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <Input
        name={label.replace(/\s+/g, "-")}
        aria-label={label}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-3"
      />
    </label>
  );
}

function SignupSelect({
  label,
  value,
  onChange,
  placeholder,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: string[];
}) {
  return (
    <Select
      name={`birth-${label}`}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-w-0 text-center"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </Select>
  );
}

function StepBar({ active }: { active: number }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[1, 2, 3].map((step) => (
        <span
          key={step}
          className={cn(
            "h-1.5 rounded-[var(--radius-pill)]",
            step <= active ? "bg-[var(--fg)]" : "bg-[var(--border)]",
          )}
        />
      ))}
    </div>
  );
}

function RoleCard({
  selected,
  title,
  description,
  imageSrc,
  imageAlt,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--surface)] text-center transition-colors",
        selected ? "border-[var(--fg)]" : "border-[var(--border)]",
      )}
    >
      <div className="aspect-[16/9] w-full overflow-hidden bg-[var(--surface-alt)]">
        <Image
          src={imageSrc}
          alt={imageAlt}
          width={900}
          height={506}
          sizes="(max-width: 480px) 100vw, 480px"
          className="h-full w-full object-cover"
        />
      </div>
      <div className="p-5">
        <h2 className="ds-h2">{title}</h2>
        <p className="ds-body ds-muted mt-3">{description}</p>
      </div>
    </button>
  );
}

function ImageBox({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[var(--surface-alt)]",
        className,
      )}
    >
      {src ? (
        <BackgroundImage src={src} alt={alt} className="absolute inset-0" />
      ) : (
        <>
          <span className="absolute inset-x-[-20%] top-1/2 h-px rotate-45 bg-[var(--fg-faint)]" />
          <span className="absolute inset-x-[-20%] top-1/2 h-px -rotate-45 bg-[var(--fg-faint)]" />
        </>
      )}
    </div>
  );
}

function BackgroundImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <span
      className={cn("block h-full w-full bg-cover bg-center", className)}
      style={{ backgroundImage: `url(${src})` }}
      role="img"
      aria-label={alt}
    />
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[var(--radius-sm)] bg-[var(--surface-alt)] px-2 py-1 text-[12px] font-medium leading-[1.4] text-[var(--fg-muted)]">
      {children}
    </span>
  );
}

function Divider() {
  return <div className="h-px bg-[var(--border-strong)]" />;
}

function BrandFilterChips({
  options,
  selected,
  onToggle,
  customValue,
  customOpen,
  onCustomValueChange,
  onCustomOpenChange,
  onAddCustom,
  inputName,
  placeholder,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
  customValue: string;
  customOpen: boolean;
  onCustomValueChange: (value: string) => void;
  onCustomOpenChange: (open: boolean) => void;
  onAddCustom: (value: string) => void;
  inputName: string;
  placeholder: string;
}) {
  const customSelections = selected.filter(
    (value) => !options.includes(value) && value !== "기타",
  );
  const addCustom = () => {
    const value = customValue.trim();
    if (!value) return;

    onAddCustom(value);
    onCustomValueChange("");
    onCustomOpenChange(false);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={cn(
              "rounded-[var(--radius-pill)] border px-3 py-1 text-[12px] font-medium",
              selected.includes(option)
                ? "border-[var(--fg)] bg-[var(--fg)] font-bold text-[var(--surface)]"
                : "border-[var(--border-strong)] bg-[var(--surface-alt)] text-[var(--fg-muted)]",
            )}
          >
            {option}
          </button>
        ))}
        {customSelections.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onToggle(value)}
            className="rounded-[var(--radius-pill)] border border-[var(--fg)] bg-[var(--fg)] px-3 py-1 text-[12px] font-bold text-[var(--surface)]"
          >
            {value}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            if (customOpen) {
              addCustom();
              return;
            }
            onCustomOpenChange(true);
          }}
          className="rounded-[var(--radius-pill)] border border-dashed border-[var(--border-dashed)] px-3 py-1 text-[12px] text-[var(--fg-muted)]"
        >
          + 브랜드 추가
        </button>
      </div>
      {customOpen ? (
        <div className="mt-3 flex gap-2">
          <input
            name={inputName}
            value={customValue}
            onChange={(event) => onCustomValueChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustom();
              }
            }}
            placeholder={placeholder}
            className="h-11 min-w-0 flex-1 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-[15px] outline-none placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)]"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!customValue.trim()}
            className="h-11 rounded-[var(--radius-lg)] border border-[var(--border-strong)] px-4 text-[13px] font-bold text-[var(--fg)] disabled:opacity-40"
          >
            추가
          </button>
        </div>
      ) : null}
    </>
  );
}

function PreferredBeanChips({
  beans,
  value,
  onValueChange,
  onAdd,
  onRemove,
}: {
  beans: string[];
  value: string;
  onValueChange: (value: string) => void;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const addBean = () => {
    const bean = value.trim();
    if (!bean) return;

    onAdd(bean);
    onValueChange("");
  };

  return (
    <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--border-strong)] p-3">
      <div className="flex flex-wrap gap-2">
        {beans.map((bean) => (
          <span
            key={bean}
            className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--fg)] bg-[var(--fg)] px-3 py-1 text-[12px] font-bold text-[var(--surface)]"
          >
            {bean}
            <button
              type="button"
              aria-label={`${bean} 삭제`}
              onClick={() => onRemove(bean)}
              className="-mr-1 flex h-5 w-5 items-center justify-center rounded-[var(--radius-pill)] text-[var(--surface)]"
            >
              <X size={13} />
            </button>
          </span>
        ))}
      </div>
      <div className={cn("flex gap-2", beans.length > 0 ? "mt-3" : "")}>
        <input
          name="preferredBeans"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addBean();
            }
          }}
          placeholder="예: 에티오피아 내추럴"
          className="h-11 min-w-0 flex-1 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-[15px] outline-none placeholder:text-[var(--fg-muted)] focus:border-[var(--accent)]"
        />
        <button
          type="button"
          onClick={addBean}
          disabled={!value.trim()}
          className="h-11 rounded-[var(--radius-lg)] border border-[var(--border-strong)] px-4 text-[13px] font-bold text-[var(--fg)] disabled:opacity-40"
        >
          추가
        </button>
      </div>
      <p className="mt-2 text-[12px] text-[var(--fg-muted)]">
        여러 원두를 하나씩 추가해 주세요.
      </p>
    </div>
  );
}

function FilterChips({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onToggle(option)}
          className={cn(
            "rounded-[var(--radius-pill)] border px-3 py-1 text-[12px] font-medium",
            selected.includes(option)
              ? "border-[var(--fg)] bg-[var(--fg)] font-bold text-[var(--surface)]"
              : "border-[var(--border-strong)] bg-[var(--surface-alt)] text-[var(--fg-muted)]",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function TextInput({
  label,
  placeholder,
  defaultValue,
  icon,
  prefixIcon,
  prefix,
  onValueChange,
}: {
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  icon?: ReactNode;
  prefixIcon?: ReactNode;
  prefix?: string;
  onValueChange?: (value: string) => void;
}) {
  return (
    <label className="block">
      {label ? <FieldLabel variant="profile">{label}</FieldLabel> : null}
      <div className="mt-2 flex h-12 items-center overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] focus-within:border-[var(--accent)]">
        {prefix ? (
          <span className="flex h-full w-12 items-center justify-center border-r border-[var(--border-strong)] text-[13px] font-bold text-[var(--fg-muted)]">
            {prefix}
          </span>
        ) : null}
        {prefixIcon ? (
          <span className="flex h-full w-12 items-center justify-center border-r border-[var(--border-strong)]">
            {prefixIcon}
          </span>
        ) : null}
        {icon ? (
          <span className="flex h-full w-12 items-center justify-center text-[var(--fg-muted)]">
            {icon}
          </span>
        ) : null}
        <input
          name={(label ?? placeholder ?? prefix ?? "textField").replace(
            /\s+/g,
            "-",
          )}
          aria-label={label ?? placeholder ?? prefix ?? "입력"}
          defaultValue={defaultValue}
          placeholder={placeholder}
          onChange={(event) => onValueChange?.(event.target.value)}
          className="min-w-0 flex-1 bg-transparent px-4 text-[16px] outline-none placeholder:text-[var(--fg-subtle)]"
        />
      </div>
    </label>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-[16px] font-bold text-[var(--fg-strong)]">{title}</p>
      {description ? (
        <p className="mt-2 text-[14px] text-[var(--fg-muted)]">{description}</p>
      ) : null}
    </div>
  );
}
