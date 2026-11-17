"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  ArrowUp,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Eye,
  FileText,
  Heart,
  MapPin,
  MessageSquare,
  Pencil,
  Plus,
  SquarePen,
} from "lucide-react";
import {
  canWriteTalkAudience,
  defaultTalkAudienceForRole,
  resolveTalkAudience,
  type TalkAudience,
} from "@/domain/community/talkAudience";
import type {
  CategoryFilter,
  CommunityEvent,
  CommunitySnapshot,
  CommunityTab,
  EventCategory,
  EventReview,
  QaComment,
  QaPost,
  Recipe,
} from "@/domain/community/types";
import {
  isCleartextHttpUrl,
  normalizeEventApplyUrl,
} from "@/domain/community/eventApplyUrl";
import { isNativeBridgeAvailable, nativeBridge } from "@/bridge/nativeBridge";
import {
  eventSchedule,
  formatCalendarEventSegmentLabel,
  formatEventDate,
  formatEventScheduleDisplay,
  formatEventTime,
  minimumEventEnd,
} from "@/ui/community/eventSchedule";
import { formatRelativeTime } from "@/domain/member/dateTime";
import { useCommunityStore } from "@/store/communityStore";
import { DetailAuthorMeta } from "@/ui/shared/DetailAuthorMeta";
import { Button } from "@/ui/shared/Button";
import { AnchorButton } from "@/ui/shared/LinkButton";
import { buildProfileHref } from "@/ui/shared/profileNavigation";
import { stopGlobalLoading } from "@/ui/shared/GlobalLoadingBar";
import { HeaderIconActions } from "@/ui/shared/HeaderIconActions";
import { ImageAttachmentSection } from "@/ui/shared/ImageAttachmentSection";
import {
  attachedImageFiles,
  createAttachedImage,
  filterImageFiles,
  IMAGE_ACCEPT,
  revokeAttachedImages,
  type AttachedImage,
  useAttachedImageCleanup,
} from "@/ui/shared/imageAttachments";
import { useImageCropFlow } from "@/ui/shared/ImageCropEditor";
import { ImageDetailSlider } from "@/ui/shared/ImageDetailSlider";
import {
  isNativeImagePickerAvailable,
  pickNativeImageFiles,
} from "@/ui/shared/nativeImagePicker";
import { CommunityShell } from "@/ui/community/CommunityShell";
import { EventLocationMap } from "@/ui/community/EventLocationMap";
import { EventPlaceSearchField } from "@/ui/community/EventPlaceSearchField";
import { ViewCountMeta } from "@/ui/shared/ViewCountMeta";
import { listenForBlockedUser } from "@/ui/shared/blockedUserEvent";
import { CommentThread } from "@/ui/shared/CommentThread";
import { ContentActionMenu } from "@/ui/community/ContentActionMenu";
import {
  getCalendarMonthSwipeDelta,
  type CalendarSwipePoint,
} from "@/ui/community/calendarSwipe";
import { trackContentView } from "@/adapters/http/contentViews";
import {
  createCommunityEvent,
  createEventRequest,
  createEventReview,
  createQaComment,
  createQaPost,
  createQaReply,
  createRecipe,
  createRecipeComment,
  createRecipeReply,
  deleteCommunityEvent,
  deleteEventReview,
  deleteQaComment,
  deleteQaPost,
  deleteRecipe,
  deleteRecipeComment,
  likeEventReview,
  likeQaComment,
  likeQaPost,
  likeRecipe,
  likeRecipeComment,
  updateEventReview,
  updateCommunityEvent,
  updateQaComment,
  updateQaPost,
  updateRecipe,
  updateRecipeComment,
} from "@/adapters/http/communityMutations";
import {
  MAX_UPLOAD_FILE_SIZE,
  MAX_UPLOAD_IMAGE_SIZE,
  UPLOAD_FILE_SIZE_ERROR_MESSAGE,
  UPLOAD_IMAGE_SIZE_ERROR_MESSAGE,
  uploadPartnerAttachments,
  uploadImages,
} from "@/adapters/http/uploadApi";
import {
  buildCommunityImagePayload,
  COMMUNITY_IMAGE_ATTACHMENT_LIMIT,
  mergeCommunityImageAttachments,
  remainingCommunityImageAttachmentCount,
} from "@/ui/community/communityImageAttachments";
import {
  filterEventsByRange,
  getEventsForDate,
  getEventsOverlappingRange,
  getUpcomingWeekEvents,
  getWeekEventSegments,
  placeWeekEventSegments,
  parseEventDate,
  type EventRangeFilter,
} from "@/ui/community/eventFilters";

type CommunityAppProps = {
  view: string[];
};

type ScreenProps = {
  snapshot: CommunitySnapshot;
  view: string[];
};

const COMMUNITY_IMAGE_LIMIT = MAX_UPLOAD_IMAGE_SIZE;
const B_TALK_BASE_PATH = "/community/b-talk";

function publicBTalkId(id: string) {
  return id.replace(/^recipe-/, "b-talk-");
}

function storedBTalkId(id: string) {
  return id.replace(/^b-talk-/, "recipe-");
}

function bTalkHref(id: string) {
  return `${B_TALK_BASE_PATH}/${publicBTalkId(id)}`;
}

const categoryMeta = {
  official: {
    label: "공식",
    en: "Official",
    dot: "bg-[var(--dot-yellow)]",
    hl: "hl-yellow",
    chip: "border-[var(--dot-yellow)] bg-[var(--hl-yellow)]",
  },
  seminar: {
    label: "세미나",
    en: "Seminar",
    dot: "bg-[var(--dot-blue)]",
    hl: "hl-blue",
    chip: "border-[var(--dot-blue)] bg-[var(--hl-blue)]",
  },
  meetup: {
    label: "비공식",
    en: "Meetup",
    dot: "bg-[var(--dot-green)]",
    hl: "hl-green",
    chip: "border-[var(--dot-green)] bg-[var(--hl-green)]",
  },
} satisfies Record<
  EventCategory,
  { label: string; en: string; dot: string; hl: string; chip: string }
>;

function cn(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function useScrolledFromTop() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const updateScrolled = () => setScrolled(window.scrollY > 8);
    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });

    return () => window.removeEventListener("scroll", updateScrolled);
  }, []);

  return scrolled;
}

function FloatingWriteAction({ href, label }: { href: string; label: string }) {
  const scrolled = useScrolledFromTop();
  const Icon = scrolled ? Pencil : SquarePen;

  return (
    <div className="fixed bottom-[calc(var(--app-bottom-nav-height)+16px)] right-5 z-40 flex flex-col items-end gap-2">
      {scrolled ? (
        <button
          type="button"
          aria-label="맨 위로 이동"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex h-13 w-13 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--fg)] shadow-[var(--shadow-modal)] transition active:scale-[0.98]"
        >
          <ArrowUp size={25} strokeWidth={1.8} />
        </button>
      ) : null}
      <Link
        prefetch={false}
        href={href}
        aria-label={label}
        className="flex h-13 w-13 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--fg-strong)] text-[var(--surface)] shadow-[var(--shadow-modal)] transition active:scale-[0.98]"
      >
        <Icon size={24} strokeWidth={2.1} />
      </Link>
    </div>
  );
}

function createExistingAttachedImage(
  url: string,
  index: number,
): AttachedImage {
  return {
    id: `existing-${index}-${url}`,
    name: `이미지 ${index + 1}`,
    size: 0,
    url,
    contentType: "image/jpeg",
  };
}

function existingAttachedImageUrls(images: AttachedImage[]) {
  return images.flatMap((image) => (image.file ? [] : [image.url]));
}

function qaImageUrls(post: QaPost) {
  return post.imageUrls?.length
    ? post.imageUrls
    : post.imageUrl
      ? [post.imageUrl]
      : [];
}

function recipeImageUrls(recipe: Recipe) {
  return recipe.processImages.length
    ? recipe.processImages
    : recipe.coverUrl
      ? [recipe.coverUrl]
      : [];
}

function findBTalkByRouteId(recipes: Recipe[], routeId: string) {
  return recipes.find(
    (recipe) =>
      recipe.id === routeId ||
      publicBTalkId(recipe.id) === routeId ||
      recipe.id === storedBTalkId(routeId),
  );
}

function activeTabFromView(
  view: string[],
  snapshot?: CommunitySnapshot | null,
): CommunityTab {
  const root = view[0] ?? "calendar";
  if (root === "talk") {
    const audience =
      view[1] === "barista" || view[1] === "enthusiast"
        ? view[1]
        : defaultTalkAudienceForRole(snapshot?.viewerRole);
    return audience === "barista" ? "talk-barista" : "talk-enthusiast";
  }
  if (root === "b-talk" || root === "recipe") {
    const second = view[1];
    if (second && second !== "new" && snapshot) {
      const recipe = findBTalkByRouteId(snapshot.recipes, second);
      if (recipe) {
        return resolveTalkAudience(recipe.audience) === "enthusiast"
          ? "talk-enthusiast"
          : "talk-barista";
      }
    }
    return "talk-barista";
  }
  if (root === "qa") return "qa";
  return "calendar";
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function timeKey(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function parseDate(value: string) {
  return parseEventDate(value);
}

function formatDate(value: string) {
  const date = parseDate(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(value: string) {
  return parseDate(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatEventRange(event: CommunityEvent) {
  const start = parseDate(event.startsAt);
  const end = event.endsAt ? parseDate(event.endsAt) : undefined;
  const startDate = formatDate(event.startsAt);
  if (!end) return `${startDate}, ${formatTime(event.startsAt)}`;

  const sameDay = dateKey(start) === dateKey(end);
  if (sameDay)
    return `${startDate}, ${formatTime(event.startsAt)} - ${formatTime(event.endsAt!)}`;

  return `${startDate} - ${formatDate(event.endsAt!)}, ${formatTime(event.startsAt)}`;
}

function dateFromId(id: string) {
  const timestamp = id.match(/(?:^|-)(1\d{12})(?:-|$)/)?.[1];
  if (!timestamp) return undefined;
  const date = new Date(Number(timestamp));
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function recipeCreatedAt(recipe: Recipe) {
  return recipe.createdAt ?? dateFromId(recipe.id);
}

function formatCompactCount(value: number) {
  return value >= 1000
    ? `${Number((value / 1000).toFixed(1))}k`
    : String(value);
}

function paginate<T>(items: T[], page: number, perPage: number) {
  return items.slice((page - 1) * perPage, page * perPage);
}

function sortReviews(reviews: EventReview[]) {
  return [...reviews].sort(
    (a, b) =>
      parseDate(b.createdAt).getTime() - parseDate(a.createdAt).getTime(),
  );
}

function filteredByCategory<T extends { category: EventCategory }>(
  items: T[],
  filter: CategoryFilter,
) {
  return filter === "all"
    ? items
    : items.filter((item) => item.category === filter);
}

function safeKeywords(keywords: string[], limit = 4) {
  const visible = keywords.slice(0, limit);
  return keywords.length > limit ? [...visible, "..."] : visible;
}

export function CommunityApp({ view }: CommunityAppProps) {
  const snapshot = useCommunityStore((state) => state.snapshot);
  const status = useCommunityStore((state) => state.status);
  const error = useCommunityStore((state) => state.error);
  const load = useCommunityStore((state) => state.load);
  const removeBlockedUser = useCommunityStore(
    (state) => state.removeBlockedUser,
  );
  const activeTab = activeTabFromView(view, snapshot);
  const viewKey = view.join("/");

  useEffect(() => {
    void load({ force: true });
  }, [load, viewKey]);

  useEffect(() => {
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
  }, [load]);

  useEffect(
    () =>
      listenForBlockedUser((userId) => {
        removeBlockedUser(userId);
        void load({ force: true });
      }),
    [load, removeBlockedUser],
  );

  useEffect(() => {
    if (snapshot || status === "error") {
      stopGlobalLoading();
    }
  }, [snapshot, status]);

  if (status === "error") {
    return (
      <CommunityShell activeTab={activeTab} view={view}>
        <EmptyState
          title="데이터를 불러오지 못했습니다."
          description={error ?? "잠시 후 다시 시도해주세요."}
        />
      </CommunityShell>
    );
  }

  if (!snapshot) {
    return (
      <CommunityShell activeTab={activeTab} view={view}>
        <div className="space-y-4 px-6 py-12">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-[var(--surface-alt)]"
            />
          ))}
        </div>
      </CommunityShell>
    );
  }

  return (
    <CommunityShell
      activeTab={activeTab}
      view={view}
      headerAction={<CommunityHeaderAction snapshot={snapshot} view={view} />}
    >
      <ScreenRouter snapshot={snapshot} view={view} />
    </CommunityShell>
  );
}

function CommunityHeaderAction({
  snapshot,
  view,
}: {
  snapshot: CommunitySnapshot;
  view: string[];
}) {
  const router = useRouter();
  const removeEvent = useCommunityStore((state) => state.removeEvent);
  const removeReview = useCommunityStore((state) => state.removeReview);
  const removeRecipe = useCommunityStore((state) => state.removeRecipe);
  const removeQaPost = useCommunityStore((state) => state.removeQaPost);
  const [deleting, setDeleting] = useState(false);
  const [root, id] = view;

  if (root === "events" && id && id !== "new") {
    const event = snapshot.events.find((item) => item.id === id);
    if (!event) return null;
    const canManage = event.canManage ?? event.isOwner;
    if (!canManage) {
      return event.authorId ? (
        <ContentActionMenu
          label="일정"
          report={{ targetId: event.id, authorId: event.authorId }}
        />
      ) : null;
    }

    return (
      <ContentActionMenu
        editHref={`/community/events/new?edit=${event.id}`}
        onDelete={async () => {
          if (deleting) return;
          setDeleting(true);
          try {
            await deleteCommunityEvent(event.id);
            removeEvent(event.id);
            router.push("/community/events");
          } finally {
            setDeleting(false);
          }
        }}
        deleting={deleting}
        label="일정"
        report={
          !event.isOwner && event.authorId
            ? { targetId: event.id, authorId: event.authorId }
            : undefined
        }
      />
    );
  }

  if (root === "reviews" && id && id !== "new") {
    const review = snapshot.reviews.find((item) => item.id === id);
    if (!review) return null;
    const canManage = review.canManage ?? review.isOwner;
    if (!canManage) {
      return review.authorId ? (
        <ContentActionMenu
          label="후기"
          report={{ targetId: review.id, authorId: review.authorId }}
        />
      ) : null;
    }

    return (
      <ContentActionMenu
        editHref={`/community/reviews/new?edit=${review.id}`}
        onDelete={async () => {
          if (deleting) return;
          setDeleting(true);
          try {
            await deleteEventReview(review.id);
            removeReview(review.id);
            router.push("/community/reviews");
          } finally {
            setDeleting(false);
          }
        }}
        deleting={deleting}
        label="후기"
        report={
          !review.isOwner && review.authorId
            ? { targetId: review.id, authorId: review.authorId }
            : undefined
        }
      />
    );
  }

  if ((root === "b-talk" || root === "recipe") && id && id !== "new") {
    const recipe = findBTalkByRouteId(snapshot.recipes, id);
    if (!recipe) return null;
    const canManage = recipe.canManage ?? recipe.isOwner;
    if (!canManage) {
      return recipe.authorId ? (
        <ContentActionMenu
          label="B-TALK"
          report={{ targetId: recipe.id, authorId: recipe.authorId }}
        />
      ) : null;
    }

    return (
      <ContentActionMenu
        editHref={`${B_TALK_BASE_PATH}/new?edit=${recipe.id}`}
        onDelete={async () => {
          if (deleting) return;
          setDeleting(true);
          try {
            await deleteRecipe(recipe.id);
            removeRecipe(recipe.id);
            router.push(B_TALK_BASE_PATH);
          } finally {
            setDeleting(false);
          }
        }}
        deleting={deleting}
        label="B-TALK"
        report={
          !recipe.isOwner && recipe.authorId
            ? { targetId: recipe.id, authorId: recipe.authorId }
            : undefined
        }
      />
    );
  }

  if (root === "qa" && id && id !== "new") {
    const post = snapshot.qaPosts.find((item) => item.id === id);
    if (!post) return null;
    const canManage = post.canManage ?? post.isOwner;
    if (!canManage) {
      return post.authorId ? (
        <ContentActionMenu
          label="질문"
          report={{ targetId: post.id, authorId: post.authorId }}
        />
      ) : null;
    }

    return (
      <ContentActionMenu
        editHref={`/community/qa/new?edit=${post.id}`}
        onDelete={async () => {
          if (deleting) return;
          setDeleting(true);
          try {
            await deleteQaPost(post.id);
            removeQaPost(post.id);
            router.push("/community/qa");
          } finally {
            setDeleting(false);
          }
        }}
        deleting={deleting}
        label="질문"
        report={
          !post.isOwner && post.authorId
            ? { targetId: post.id, authorId: post.authorId }
            : undefined
        }
      />
    );
  }

  return (
    <HeaderIconActions searchHref="/home/search" loadUnreadNotifications />
  );
}

function ScreenRouter({ snapshot, view }: ScreenProps) {
  const root = view[0] ?? "calendar";
  const second = view[1];

  if (root === "events") {
    if (second === "request") return <EventRequestScreen />;
    if (second === "new") return <EventCreateScreen snapshot={snapshot} />;
    if (second)
      return <EventDetailScreen snapshot={snapshot} eventId={second} />;
    return <EventsScreen snapshot={snapshot} />;
  }

  if (root === "reviews") {
    if (second === "new") return <ReviewCreateScreen snapshot={snapshot} />;
    if (second)
      return <ReviewDetailScreen snapshot={snapshot} reviewId={second} />;
    return <ReviewListScreen snapshot={snapshot} />;
  }

  if (root === "talk") {
    const audience: TalkAudience =
      second === "barista" || second === "enthusiast"
        ? second
        : defaultTalkAudienceForRole(snapshot.viewerRole);
    return <RecipeListScreen snapshot={snapshot} audience={audience} />;
  }

  if (root === "b-talk" || root === "recipe") {
    if (second === "new") return <RecipeCreateScreen snapshot={snapshot} />;
    if (second)
      return <RecipeDetailScreen snapshot={snapshot} recipeId={second} />;
    return <RecipeListScreen snapshot={snapshot} audience="barista" />;
  }

  if (root === "qa") {
    if (second === "new") return <QaCreateScreen snapshot={snapshot} />;
    if (second) return <QaDetailScreen snapshot={snapshot} postId={second} />;
    return <QaListScreen snapshot={snapshot} />;
  }

  return <CalendarScreen snapshot={snapshot} />;
}

function CalendarScreen({ snapshot }: { snapshot: CommunitySnapshot }) {
  const calendarMonth = useCommunityStore((state) => state.calendarMonth);
  const shiftCalendarMonth = useCommunityStore(
    (state) => state.shiftCalendarMonth,
  );
  const [touchStart, setTouchStart] = useState<CalendarSwipePoint | null>(null);
  const today = new Date();
  const monthStart = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth(),
    1,
  );
  const monthEnd = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
    0,
    23,
    59,
    59,
  );
  const monthEvents = getEventsOverlappingRange(
    snapshot.events,
    monthStart,
    monthEnd,
  );
  const upcomingWeek = getUpcomingWeekEvents(snapshot.events, today).slice(
    0,
    5,
  );
  const latestReviews = sortReviews(snapshot.reviews).slice(0, 5);

  return (
    <div className="min-h-[calc(100dvh-128px)] bg-[var(--surface-alt)] px-4 py-4 pb-8">
      <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-5">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-[17px] font-bold tracking-[0.16em] text-[var(--fg-strong)]">
            {calendarMonth.getFullYear()}년 {calendarMonth.getMonth() + 1}월
          </h1>
          <Legend compact />
        </div>
        <div
          className="select-none transition-transform duration-300"
          onTouchStart={(event) => {
            const touch = event.touches[0];
            setTouchStart(
              touch ? { x: touch.clientX, y: touch.clientY } : null,
            );
          }}
          onTouchEnd={(event) => {
            if (touchStart === null) return;
            const touch = event.changedTouches[0];
            const delta = getCalendarMonthSwipeDelta(
              touchStart,
              touch ? { x: touch.clientX, y: touch.clientY } : touchStart,
            );
            if (delta !== 0) shiftCalendarMonth(delta);
            setTouchStart(null);
          }}
        >
          <CalendarGrid
            month={calendarMonth}
            events={snapshot.events}
            today={today}
          />
        </div>
        {monthEvents.length === 0 ? (
          <p className="mt-4 border-t border-[var(--border)] px-4 pt-4 text-center text-[14px] text-[var(--fg-muted)]">
            이번 달 예정된 일정이 없습니다
          </p>
        ) : null}
      </section>

      <section className="mt-5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-5 py-5">
        <SectionHeader
          title="이번 주 일정"
          href="/community/events?range=week"
        />
        {upcomingWeek.length > 0 ? (
          <div className="mt-4 space-y-4">
            {upcomingWeek.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <p className="px-4 pt-5 text-center text-[14px] text-[var(--fg-muted)]">
            이번 주 예정된 일정이 없습니다
          </p>
        )}
      </section>

      {latestReviews.length > 0 ? (
        <section className="mt-5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-5 py-5">
          <SectionHeader title="이벤트 후기" href="/community/reviews" />
          <div className="mt-4 space-y-5">
            {latestReviews.map((review) => (
              <ReviewTeaser key={review.id} review={review} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CalendarGrid({
  month,
  events,
  today,
}: {
  month: Date;
  events: CommunityEvent[];
  today: Date;
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = first.getDay();
  const days = Array.from(
    { length: 42 },
    (_, index) =>
      new Date(month.getFullYear(), month.getMonth(), index - startOffset + 1),
  );
  const priority: Record<EventCategory, number> = {
    official: 0,
    seminar: 1,
    meetup: 2,
  };
  const weeks = Array.from({ length: 6 }, (_, index) =>
    days.slice(index * 7, index * 7 + 7),
  );

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 text-center text-[12px] text-[var(--fg-subtle)]">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <div key={`${day}-${index}`} className="py-2">
            {day}
          </div>
        ))}
      </div>
      <div>
        {weeks.map((week) => {
          const weekStart = week[0];
          const layout = placeWeekEventSegments(
            getWeekEventSegments(events, weekStart).sort((a, b) => {
              const timeDiff =
                parseDate(a.event.startsAt).getTime() -
                parseDate(b.event.startsAt).getTime();
              return (
                timeDiff ||
                priority[a.event.category] - priority[b.event.category]
              );
            }),
          );

          return (
            <div key={dateKey(weekStart)} className="relative grid grid-cols-7">
              {week.map((day, column) => {
                const key = dateKey(day);
                const dayEvents = getEventsForDate(events, day);
                const overflowCount = Math.max(
                  dayEvents.length - 2,
                  layout.overflowByColumn[column] ?? 0,
                );
                const inMonth = day.getMonth() === month.getMonth();
                const isToday = key === dateKey(today);
                return (
                  <div key={key} className="h-20 px-0.5 pt-1">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-[var(--radius-pill)] text-[14px]",
                        "mx-auto",
                        !inMonth && "text-[var(--fg-faint)]",
                        inMonth && "text-[var(--fg)]",
                        isToday && "bg-[var(--accent)] font-bold text-white",
                      )}
                    >
                      {day.getDate()}
                    </div>
                    {overflowCount > 0 ? (
                      <div className="mt-7 px-1 text-[10px] leading-3 text-[var(--fg-muted)]">
                        +{overflowCount}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <div className="pointer-events-none absolute inset-x-0 top-9 grid grid-cols-7 grid-rows-2 gap-y-0.5">
                {layout.segments.map((segment) =>
                  segment.row < 0 ? null : (
                    <Link
                      prefetch={false}
                      key={segment.event.id}
                      href={`/community/events/${segment.event.id}`}
                      aria-label={`${
                        segment.continuesBefore ? "계속되는 " : ""
                      }${segment.event.title} 상세 보기`}
                      className={cn(
                        "pointer-events-auto block truncate px-1 text-left text-[10px] leading-3 text-[var(--fg)]",
                        "hl",
                        categoryMeta[segment.event.category].hl,
                        !segment.continuesBefore &&
                          "rounded-l-[var(--radius-sm)]",
                        !segment.continuesAfter &&
                          "rounded-r-[var(--radius-sm)]",
                      )}
                      style={{
                        gridColumn: `${segment.startColumn + 1} / span ${segment.span}`,
                        gridRow: segment.row + 1,
                      }}
                    >
                      {formatCalendarEventSegmentLabel(
                        segment.event.title,
                        segment.continuesBefore,
                        segment.span,
                      )}
                    </Link>
                  ),
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventsScreen({ snapshot }: { snapshot: CommunitySnapshot }) {
  const [page, setPage] = useState(1);
  const searchParams = useSearchParams();
  const filter = useCommunityStore((state) => state.eventFilter);
  const setFilter = useCommunityStore((state) => state.setEventFilter);
  const range = (
    searchParams.get("range") === "week" ? "week" : "all"
  ) satisfies EventRangeFilter;
  const filtered = filteredByCategory(
    filterEventsByRange(snapshot.events, range),
    filter,
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, totalPages);
  const pageItems = paginate(filtered, currentPage, 10);

  return (
    <div className="relative min-h-[calc(100dvh-128px)] px-6 py-7 pb-28">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-[20px] font-bold leading-[1.3] tracking-[-0.01em] text-[var(--fg-strong)]">
          Events
        </h1>
        <Legend active={filter} onSelect={setFilter} />
      </div>
      {pageItems.length === 0 ? (
        <EmptyState
          title="현재 진행 예정인 일정이 없습니다."
          description="새로운 소식을 기다려 주세요!"
        />
      ) : (
        <div className="space-y-4">
          {pageItems.map((event) => (
            <EventListCard event={event} key={event.id} />
          ))}
        </div>
      )}
      <Pagination
        page={currentPage}
        totalPages={totalPages}
        onChange={setPage}
        className="mt-10"
      />
      <div className="mt-10 space-y-3">
        <Link
          prefetch={false}
          href="/community/events/request"
          className="flex w-full items-center justify-center rounded-[var(--radius-lg)] bg-[var(--accent)] px-4 py-3 text-[14px] font-bold text-white transition active:scale-[0.98]"
        >
          일정 요청하기
        </Link>
        <Link
          prefetch={false}
          href="/community/events/new"
          className="flex w-full items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-strong)] px-4 py-3 text-[14px] font-bold text-[var(--fg)]"
        >
          관리자 일정 등록하기
        </Link>
      </div>
    </div>
  );
}

function EventDetailScreen({
  snapshot,
  eventId,
}: {
  snapshot: CommunitySnapshot;
  eventId: string;
}) {
  const event = snapshot.events.find((item) => item.id === eventId);
  const [failedPosterUrl, setFailedPosterUrl] = useState<string | null>(null);

  if (!event)
    return (
      <EmptyState
        title="일정을 찾을 수 없습니다."
        description="삭제되었거나 잘못된 주소예요."
      />
    );

  const schedule = formatEventScheduleDisplay(
    event.startsAt,
    event.endsAt,
    !!event.allDay,
  );

  return (
    <article className="px-7 py-6">
      {event.posterUrl !== "/favicon.ico" ? (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
          {failedPosterUrl === event.posterUrl ? (
            <div className="flex h-[520px] w-full items-center justify-center bg-[var(--surface-alt)] text-[14px] text-[var(--fg-muted)]">
              포스터를 불러오지 못했어요.
            </div>
          ) : (
            <Image
              src={event.posterUrl}
              alt=""
              width={900}
              height={1300}
              sizes="(max-width: 480px) 100vw, 480px"
              unoptimized={/^https?:\/\//i.test(event.posterUrl)}
              onError={() => setFailedPosterUrl(event.posterUrl)}
              className="h-[520px] w-full object-cover"
            />
          )}
        </div>
      ) : null}
      <h1 className="mt-8 text-[16px] font-bold leading-[1.35] tracking-[-0.01em] text-[var(--fg-strong)]">
        {event.title}
      </h1>
      <p className="mt-7 whitespace-pre-wrap text-[16px] leading-[1.8] text-[var(--fg)]">
        {event.description}
      </p>
      {event.attachmentUrl ? (
        <a
          href={event.attachmentUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-6 flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-strong)] px-4 py-3 text-[14px] font-medium text-[var(--fg)]"
        >
          <FileText size={20} className="text-[var(--fg-muted)]" />
          <span className="min-w-0 truncate">
            {event.attachmentName ?? "첨부 파일"}
          </span>
        </a>
      ) : null}
      <div className="mt-6 space-y-4">
        <InfoBox
          icon={<CalendarDays size={20} />}
          label="SCHEDULE"
          title={schedule.title}
          body={schedule.body}
        />
        <InfoBox
          icon={<MapPin size={20} />}
          label="LOCATION"
          title={event.location}
          body={event.address}
        />
        <EventLocationMap location={event.location} address={event.address} />
      </div>
      <div className="mt-10">
        {event.applyUrl ? (
          <AnchorButton
            href={event.applyUrl}
            onClick={(click) => {
              const applyUrl = event.applyUrl;
              if (!applyUrl || !isCleartextHttpUrl(applyUrl)) return;
              if (!isNativeBridgeAvailable()) return;
              click.preventDefault();
              void nativeBridge.openExternalUrl({ url: applyUrl });
            }}
          >
            참가 신청하기
          </AnchorButton>
        ) : (
          <button
            type="button"
            onClick={() => window.alert("연결된 신청 링크가 없습니다.")}
            className="w-full rounded-[var(--radius-lg)] bg-[var(--accent)] px-7 py-5 text-[18px] font-bold text-white shadow-[var(--shadow-card)] active:scale-[0.98]"
          >
            참가 신청하기
          </button>
        )}
      </div>
    </article>
  );
}

function EventRequestScreen() {
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  const [category, setCategory] = useState<EventCategory>("official");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [startDate, setStartDate] = useState(() => dateKey(startsAt));
  const [startTime, setStartTime] = useState(() => timeKey(startsAt));
  const [endDate, setEndDate] = useState(() => dateKey(endsAt));
  const [endTime, setEndTime] = useState(() => timeKey(endsAt));
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [applyUrl, setApplyUrl] = useState("");
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  useAttachedImageCleanup(attachedImages);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureMinimumEnd = (
    nextStartDate: string,
    nextStartTime: string,
    nextAllDay: boolean,
  ) => {
    if (
      eventSchedule(nextStartDate, nextStartTime, endDate, endTime, nextAllDay)
        .isValid
    )
      return;

    const nextEnd = minimumEventEnd(nextStartDate, nextStartTime, nextAllDay);
    setEndDate(nextEnd.date);
    setEndTime(nextEnd.time);
  };

  const attachImages = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      setError("JPG 또는 PNG 파일만 첨부할 수 있습니다.");
      return;
    }
    if (file.size > MAX_UPLOAD_IMAGE_SIZE) {
      setError(UPLOAD_IMAGE_SIZE_ERROR_MESSAGE);
      return;
    }

    const image = createAttachedImage(file);
    setAttachedImages((current) => {
      revokeAttachedImages(current);
      return [image];
    });
    setError(null);
  };

  const submit = async () => {
    if (!title.trim() || !body.trim() || submitting) return;

    const schedule = eventSchedule(
      startDate,
      startTime,
      endDate,
      endTime,
      allDay,
    );
    if (!schedule.isValid) {
      setError("종료 일정은 시작 일정 이후로 설정해주세요.");
      return;
    }
    const normalizedApplyUrl = normalizeEventApplyUrl(applyUrl);
    if (normalizedApplyUrl === null) {
      setError("신청 링크는 http 또는 https URL로 입력해주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const [imageUrl] = attachedImages.length
        ? await uploadImages(
            attachedImageFiles(attachedImages),
            "community/event-requests",
          )
        : [];
      await createEventRequest({
        title: title.trim(),
        category,
        body: body.trim(),
        imageUrl,
        schedule: `${formatEventDate(startDate)} - ${formatEventDate(endDate)}`,
        time: allDay
          ? "종일"
          : `${formatEventTime(startTime)} - ${formatEventTime(endTime)}`,
        location: location.trim() || undefined,
        address: address.trim() || undefined,
        applyUrl: normalizedApplyUrl,
      });
      window.location.assign("/community");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "일정 요청에 실패했습니다.",
      );
      setSubmitting(false);
    }
  };

  return (
    <FormPage
      title="일정 요청하기"
      description="새로운 공식 일정, 세미나, 비공식 일정에 대한 정보를 운영팀에 제출해 주세요."
    >
      <FloatingInput
        label=""
        value={title}
        onChange={setTitle}
        placeholder="제목을 입력하세요"
      />
      <FieldGroup title="카테고리">
        <CategoryChips value={category} onChange={setCategory} />
      </FieldGroup>
      <FloatingTextarea
        label="내용 (최대 500자)"
        value={body}
        onChange={setBody}
        maxLength={500}
        rows={7}
        placeholder="예: 8월 브루잉 세미나를 공식 일정에 추가해 주세요."
      />
      <ScheduleEditor
        startDate={startDate}
        startTime={startTime}
        endDate={endDate}
        endTime={endTime}
        allDay={allDay}
        onAllDayChange={(nextAllDay) => {
          setAllDay(nextAllDay);
          ensureMinimumEnd(startDate, startTime, nextAllDay);
        }}
        onStartDateChange={(value) => {
          setStartDate(value);
          ensureMinimumEnd(value, startTime, allDay);
        }}
        onStartTimeChange={(value) => {
          setStartTime(value);
          ensureMinimumEnd(startDate, value, allDay);
        }}
        onEndDateChange={setEndDate}
        onEndTimeChange={setEndTime}
      />
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] p-5">
        <p className="mb-3 text-[14px] font-medium text-[var(--fg)]">
          장소 설정
        </p>
        <EventPlaceSearchField
          location={location}
          address={address}
          onLocationChange={setLocation}
          onAddressChange={setAddress}
        />
      </div>
      <FloatingInput
        label="신청 링크 (선택)"
        value={applyUrl}
        onChange={setApplyUrl}
        placeholder="https://example.com/apply"
      />
      <ImageAttachmentSection
        title="이벤트 포스터 / 커버 이미지"
        images={attachedImages}
        limit={1}
        accept={IMAGE_ACCEPT}
        inputName="eventRequestImage"
        ariaPrefix="일정 요청"
        addLabel="이미지 첨부"
        onAttachImages={attachImages}
        onRemoveImage={(image) => {
          revokeAttachedImages([image]);
          setAttachedImages((current) =>
            current.filter((currentImage) => currentImage.id !== image.id),
          );
        }}
      />
      {error ? (
        <p className="text-[13px] font-bold text-[var(--danger)]">{error}</p>
      ) : null}
      <Button
        type="button"
        disabled={!title.trim() || !body.trim() || submitting}
        onClick={submit}
      >
        {submitting ? "요청 중..." : "요청 보내기"}
      </Button>
    </FormPage>
  );
}

function EventCreateScreen({ snapshot }: { snapshot: CommunitySnapshot }) {
  const editEventId = useSearchParams().get("edit");
  const editEvent = snapshot.events.find((event) => event.id === editEventId);
  const startsAt = editEvent ? new Date(editEvent.startsAt) : new Date();
  const endsAt = editEvent?.endsAt
    ? new Date(editEvent.endsAt)
    : new Date(startsAt.getTime() + 60 * 60 * 1000);
  const [category, setCategory] = useState<EventCategory>(
    editEvent?.category ?? "official",
  );
  const [title, setTitle] = useState(editEvent?.title ?? "");
  const [body, setBody] = useState(editEvent?.description ?? "");
  const [startDate, setStartDate] = useState(() => dateKey(startsAt));
  const [startTime, setStartTime] = useState(() => timeKey(startsAt));
  const [endDate, setEndDate] = useState(() => dateKey(endsAt));
  const [endTime, setEndTime] = useState(() => timeKey(endsAt));
  const [allDay, setAllDay] = useState(editEvent?.allDay ?? false);
  const [location, setLocation] = useState(editEvent?.location ?? "");
  const [address, setAddress] = useState(editEvent?.address ?? "");
  const [applyUrl, setApplyUrl] = useState(editEvent?.applyUrl ?? "");
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>(() => {
    if (editEvent?.attachmentUrl) {
      return [
        {
          id: `existing-event-attachment-${editEvent.id}`,
          name: editEvent.attachmentName ?? "첨부 파일",
          size: 0,
          url: editEvent.attachmentUrl,
          contentType: editEvent.attachmentContentType ?? "application/pdf",
        },
      ];
    }
    if (editEvent?.imageUrl) {
      return [
        {
          id: `existing-event-image-${editEvent.id}`,
          name: "이미지",
          size: 0,
          url: editEvent.imageUrl,
          contentType: "image/jpeg",
        },
      ];
    }
    return [];
  });
  useAttachedImageCleanup(attachedImages);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureMinimumEnd = (
    nextStartDate: string,
    nextStartTime: string,
    nextAllDay: boolean,
  ) => {
    if (
      eventSchedule(nextStartDate, nextStartTime, endDate, endTime, nextAllDay)
        .isValid
    )
      return;

    const nextEnd = minimumEventEnd(nextStartDate, nextStartTime, nextAllDay);
    setEndDate(nextEnd.date);
    setEndTime(nextEnd.time);
  };

  const submit = async () => {
    if (!title.trim() || !body.trim() || submitting) return;

    const normalizedApplyUrl = normalizeEventApplyUrl(applyUrl);
    if (normalizedApplyUrl === null) {
      setError("신청 링크는 http 또는 https URL로 입력해주세요.");
      return;
    }

    const schedule = eventSchedule(
      startDate,
      startTime,
      endDate,
      endTime,
      allDay,
    );
    if (!schedule.isValid) {
      setError("종료 일정은 시작 일정 이후로 설정해주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const attachmentFile = attachedImages[0]?.file;
      const [attachment] = attachmentFile
        ? await uploadPartnerAttachments([attachmentFile], "community/events")
        : [];
      const keepsExistingAttachment = attachedImages.some(
        (image) => !image.file,
      );
      const uploadedImageUrl = attachment?.contentType.startsWith("image/")
        ? attachment.url
        : undefined;
      const imageUrl =
        uploadedImageUrl ??
        (keepsExistingAttachment ? editEvent?.imageUrl : undefined);
      const input = {
        title: title.trim(),
        category,
        description: body.trim(),
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        allDay,
        location: location.trim() || undefined,
        address: address.trim() || undefined,
        imageUrl,
        posterUrl:
          uploadedImageUrl ??
          (keepsExistingAttachment ? editEvent?.posterUrl : undefined),
        applyUrl: normalizedApplyUrl,
        attachmentUrl:
          attachment?.contentType === "application/pdf"
            ? attachment.url
            : keepsExistingAttachment
              ? editEvent?.attachmentUrl
              : undefined,
        attachmentName:
          attachment?.contentType === "application/pdf"
            ? attachment.name
            : keepsExistingAttachment
              ? editEvent?.attachmentName
              : undefined,
        attachmentContentType:
          attachment?.contentType === "application/pdf"
            ? attachment.contentType
            : keepsExistingAttachment
              ? editEvent?.attachmentContentType
              : undefined,
      };
      if (editEvent) {
        await updateCommunityEvent(editEvent.id, {
          ...input,
          location: location.trim(),
          address: address.trim(),
        });
        window.location.assign(`/community/events/${editEvent.id}`);
      } else {
        const event = await createCommunityEvent(input);
        window.location.assign(`/community/events/${event.id}`);
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "일정 등록에 실패했습니다.",
      );
      setSubmitting(false);
    }
  };

  const attachImages = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (
      file.type !== "image/jpeg" &&
      file.type !== "image/png" &&
      file.type !== "application/pdf"
    ) {
      setError("JPG, PNG 또는 PDF 파일만 첨부할 수 있습니다.");
      return;
    }
    if (file.size > MAX_UPLOAD_FILE_SIZE) {
      setError(UPLOAD_FILE_SIZE_ERROR_MESSAGE);
      return;
    }

    const image = createAttachedImage(file);
    setAttachedImages((current) => {
      revokeAttachedImages(current);
      return [image];
    });
    setError(null);
  };

  return (
    <FormPage title={editEvent ? "일정 수정하기" : "일정 등록하기"}>
      <FloatingInput
        label=""
        value={title}
        onChange={setTitle}
        placeholder="제목을 입력하세요"
      />
      <FieldGroup title="카테고리">
        <CategoryChips value={category} onChange={setCategory} />
      </FieldGroup>
      <ImageAttachmentSection
        title="첨부"
        images={attachedImages}
        limit={1}
        accept="image/jpeg,image/png,application/pdf"
        inputName="eventAttachment"
        ariaPrefix="일정"
        addLabel="첨부 파일"
        countUnit="개"
        onAttachImages={attachImages}
        onRemoveImage={(image) => {
          revokeAttachedImages([image]);
          setAttachedImages((current) =>
            current.filter((currentImage) => currentImage.id !== image.id),
          );
        }}
      />
      <FloatingTextarea
        label="상세 내용"
        value={body}
        onChange={setBody}
        maxLength={500}
        rows={7}
      />
      <FloatingInput
        label="신청 링크 (선택)"
        value={applyUrl}
        onChange={setApplyUrl}
        placeholder="https://example.com/apply"
      />
      <ScheduleEditor
        startDate={startDate}
        startTime={startTime}
        endDate={endDate}
        endTime={endTime}
        allDay={allDay}
        onAllDayChange={(nextAllDay) => {
          setAllDay(nextAllDay);
          ensureMinimumEnd(startDate, startTime, nextAllDay);
        }}
        onStartDateChange={(value) => {
          setStartDate(value);
          ensureMinimumEnd(value, startTime, allDay);
        }}
        onStartTimeChange={(value) => {
          setStartTime(value);
          ensureMinimumEnd(startDate, value, allDay);
        }}
        onEndDateChange={setEndDate}
        onEndTimeChange={setEndTime}
      />
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] p-5">
        <p className="mb-3 text-[14px] font-medium text-[var(--fg)]">
          장소 설정
        </p>
        <EventPlaceSearchField
          location={location}
          address={address}
          onLocationChange={setLocation}
          onAddressChange={setAddress}
        />
      </div>
      {error ? (
        <p className="text-[13px] font-bold text-[var(--danger)]">{error}</p>
      ) : null}
      <Button
        type="button"
        disabled={!title.trim() || !body.trim() || submitting}
        onClick={submit}
      >
        {submitting
          ? "저장 중..."
          : editEvent
            ? "일정 수정하기"
            : "일정 등록하기"}
      </Button>
    </FormPage>
  );
}

function ReviewListScreen({ snapshot }: { snapshot: CommunitySnapshot }) {
  const [page, setPage] = useState(1);
  const filter = useCommunityStore((state) => state.reviewFilter);
  const setFilter = useCommunityStore((state) => state.setReviewFilter);
  const filtered = filteredByCategory(sortReviews(snapshot.reviews), filter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, totalPages);

  return (
    <div className="relative min-h-[calc(100dvh-128px)] px-6 py-7 pb-28">
      <h1 className="mb-5 text-[19px] font-bold leading-[1.3] tracking-[0.16em] text-[var(--fg-strong)]">
        이벤트 후기
      </h1>
      <Legend active={filter} onSelect={setFilter} />
      <div className="mt-8 space-y-5">
        {paginate(filtered, currentPage, 10).map((review) => (
          <ReviewListCard key={review.id} review={review} />
        ))}
      </div>
      <Pagination
        page={currentPage}
        totalPages={totalPages}
        onChange={setPage}
        className="mt-12"
      />
      <FloatingWriteAction
        href="/community/reviews/new"
        label="이벤트 리뷰 작성"
      />
    </div>
  );
}

function ReviewDetailScreen({
  snapshot,
  reviewId,
}: {
  snapshot: CommunitySnapshot;
  reviewId: string;
}) {
  const review = snapshot.reviews.find((item) => item.id === reviewId);
  const likeState = useCommunityStore((state) => state.reviewLikes[reviewId]);
  const toggleLike = useCommunityStore((state) => state.toggleReviewLike);
  const setContentViewCount = useCommunityStore(
    (state) => state.setContentViewCount,
  );
  const trackedReviewId = review?.id;

  useEffect(() => {
    if (!trackedReviewId) return;
    void trackContentView("community_review", trackedReviewId)
      .then(({ viewCount }) =>
        setContentViewCount("community_review", trackedReviewId, viewCount),
      )
      .catch(() => undefined);
  }, [trackedReviewId, setContentViewCount]);

  if (!review)
    return (
      <EmptyState
        title="후기를 찾을 수 없습니다."
        description="삭제되었거나 잘못된 주소예요."
      />
    );

  const liked = likeState?.liked ?? review.liked ?? false;
  const likes = likeState?.likes ?? review.likes;

  return (
    <article className="px-7 py-8">
      <ImageDetailSlider images={review.imageUrls} />
      <h1 className="mt-8 text-[16px] font-bold leading-[1.35] tracking-[-0.01em] text-[var(--fg-strong)]">
        {review.title}
      </h1>
      <DetailAuthorMeta
        name={review.author.name}
        date={formatRelativeTime(review.createdAt)}
        avatarUrl={review.author.avatarUrl}
        profileHref={
          review.authorId
            ? buildProfileHref(
                review.authorId,
                `/community/reviews/${review.id}`,
              )
            : undefined
        }
        className="mt-5"
      />
      <div className="mt-3 flex items-center gap-4">
        <ViewCountMeta count={review.viewCount ?? 0} />
        <button
          type="button"
          aria-label={liked ? "이벤트 리뷰 좋아요 취소" : "이벤트 리뷰 좋아요"}
          onClick={async () => {
            const nextLiked = !liked;
            toggleLike(review.id, review.likes, review.liked);
            try {
              await likeEventReview(review.id, nextLiked);
            } catch {
              toggleLike(review.id, review.likes, review.liked);
              window.alert("관심 글 상태를 변경하지 못했습니다.");
            }
          }}
          className="flex items-center"
        >
          <LikeMeta count={likes} active={liked} />
        </button>
      </div>
      <p className="mt-6 text-[12px] leading-6 text-[var(--fg)]">
        {review.body}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {review.keywords.map((keyword, index) => (
          <span
            key={keyword}
            className={cn(
              "rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--surface-alt)] px-4 py-2 text-[13px] font-medium",
              index === review.keywords.length - 1 &&
                "border-[var(--accent)] text-[var(--accent)]",
            )}
          >
            {keyword}
          </span>
        ))}
      </div>
    </article>
  );
}

function ReviewCreateScreen({ snapshot }: { snapshot: CommunitySnapshot }) {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const editReview = editId
    ? snapshot.reviews.find((review) => review.id === editId)
    : undefined;
  const [title, setTitle] = useState(editReview?.title ?? "");
  const [body, setBody] = useState(editReview?.body ?? "");
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>(() =>
    (editReview?.imageUrls ?? []).map(createExistingAttachedImage),
  );
  const { startImageCrop, imageCropEditor } = useImageCropFlow((files) => {
    setAttachedImages((current) =>
      mergeCommunityImageAttachments(current, files.map(createAttachedImage)),
    );
  });
  const [hashtagInput, setHashtagInput] = useState("");
  const [category, setCategory] = useState<EventCategory>(
    editReview?.category ?? "official",
  );
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>(
    editReview?.keywords ?? [
      "#라떼아트세미나",
      "#커핑세미나",
      "#에스프레소추출",
      "#로스팅팁",
    ],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useAttachedImageCleanup(attachedImages);

  const addHashtag = () => {
    const normalized = hashtagInput.trim().replace(/^#?/, "#");
    if (normalized === "#") return;
    if (
      selectedHashtags.length >= 6 &&
      !selectedHashtags.includes(normalized)
    ) {
      window.alert("해시태그는 최대 6개까지 등록할 수 있습니다.");
      return;
    }
    if (!selectedHashtags.includes(normalized)) {
      setSelectedHashtags((hashtags) => [...hashtags, normalized]);
    }
    setHashtagInput("");
  };

  const submit = async () => {
    if (!title.trim() || !body.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const uploadedImageUrls =
        attachedImages.length > 0
          ? await uploadImages(
              attachedImageFiles(attachedImages),
              "community/reviews",
            )
          : [];
      const { imageUrls } = buildCommunityImagePayload({
        uploadedImageUrls,
        existingImageUrls: existingAttachedImageUrls(attachedImages),
      });
      if (editReview) {
        await updateEventReview(editReview.id, {
          title: title.trim(),
          body: body.trim(),
          category,
          imageUrls,
          keywords: selectedHashtags,
        });
        window.location.replace("/community/reviews");
        return;
      }
      const review = await createEventReview({
        title: title.trim(),
        body: body.trim(),
        category,
        imageUrls,
        keywords: selectedHashtags,
      });
      window.location.assign(`/community/reviews/${review.id}`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : `후기 ${editReview ? "수정" : "등록"}에 실패했습니다.`,
      );
      setSubmitting(false);
    }
  };

  const attachImageFiles = (files: File[]) => {
    if (files.length === 0) return;

    const remaining = remainingCommunityImageAttachmentCount(
      attachedImages.length,
    );
    if (remaining <= 0) {
      setError(
        `이미지는 최대 ${COMMUNITY_IMAGE_ATTACHMENT_LIMIT}장까지 첨부할 수 있습니다.`,
      );
      return;
    }

    if (files.length > remaining) {
      setError(`이미지는 ${remaining}장만 더 첨부할 수 있습니다.`);
    }

    const validFiles = filterImageFiles(
      files.slice(0, remaining),
      COMMUNITY_IMAGE_LIMIT,
      setError,
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
          const remaining = remainingCommunityImageAttachmentCount(
            attachedImages.length,
          );
          const files = await pickNativeImageFiles(remaining);
          attachImageFiles(files ?? []);
        } catch {
          setError("이미지 선택에 실패했습니다. 다시 시도해주세요.");
        }
      }
    : undefined;

  return (
    <>
      {imageCropEditor}
      <FormPage title={editReview ? "후기 수정하기" : "후기 작성하기"}>
        <CommunityImageUploadSection
          attachedImages={attachedImages}
          inputNamePrefix="review"
          ariaPrefix="이벤트 리뷰"
          onAttachImages={attachImages}
          onOpenNativePicker={openNativeImagePicker}
          onRemoveImage={(image) => {
            revokeAttachedImages([image]);
            setAttachedImages((current) =>
              current.filter((item) => item.id !== image.id),
            );
          }}
        />
        <input
          aria-label="후기 제목"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="제목을 입력하세요"
          className="h-14 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-[16px] font-medium text-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent)]"
        />
        <FieldGroup title="카테고리 선택">
          <CategoryChips value={category} onChange={setCategory} rounded />
        </FieldGroup>
        <FloatingTextarea
          label="내용 작성 (최대 500자)"
          value={body}
          onChange={setBody}
          maxLength={500}
          rows={7}
          placeholder="예: 세미나에서 배운 레시피와 좋았던 순간을 남겨보세요."
        />
        <FieldGroup title="해시태그">
          <div className="grid grid-cols-[minmax(0,1fr)_76px] gap-2">
            <input
              value={hashtagInput}
              onChange={(event) => setHashtagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addHashtag();
                }
              }}
              placeholder="#해시태그를 입력하세요"
              className="h-11 min-w-0 rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-[13px] outline-none placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent)]"
            />
            <button
              type="button"
              onClick={addHashtag}
              className="h-11 rounded-[var(--radius-pill)] border border-[var(--accent)] text-[13px] font-bold text-[var(--accent)]"
            >
              추가
            </button>
          </div>
          {selectedHashtags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedHashtags.map((hashtag) => (
                <button
                  key={hashtag}
                  type="button"
                  onClick={() =>
                    setSelectedHashtags((hashtags) =>
                      hashtags.filter((item) => item !== hashtag),
                    )
                  }
                  className="rounded-[var(--radius-pill)] bg-[var(--surface-alt)] px-3 py-1.5 text-[13px] font-medium text-[var(--fg)]"
                >
                  {hashtag} ×
                </button>
              ))}
            </div>
          ) : null}
        </FieldGroup>
        {error ? (
          <p className="text-[13px] font-bold text-[var(--danger)]">{error}</p>
        ) : null}
        <Button
          type="button"
          disabled={!title.trim() || !body.trim() || submitting}
          onClick={submit}
        >
          {submitting ? "저장 중..." : editReview ? "수정하기" : "등록하기"}
        </Button>
      </FormPage>
    </>
  );
}

function RecipeListScreen({
  snapshot,
  audience,
}: {
  snapshot: CommunitySnapshot;
  audience: TalkAudience;
}) {
  const [page, setPage] = useState(1);
  const filteredRecipes = snapshot.recipes.filter(
    (recipe) => resolveTalkAudience(recipe.audience) === audience,
  );
  const items = paginate(filteredRecipes, page, 10);
  const canWrite = canWriteTalkAudience(snapshot.viewerRole, audience);

  return (
    <div className="relative min-h-[calc(100dvh-128px)] pb-28">
      <div className="divide-y divide-[var(--border)] px-5 pt-2">
        {items.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </div>
      {filteredRecipes.length === 0 ? (
        <EmptyState
          title="아직 올라온 글이 없습니다."
          description="첫 번째 이야기를 시작해 주세요."
        />
      ) : null}
      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(filteredRecipes.length / 10))}
        onChange={setPage}
        className="mt-8"
      />
      {canWrite ? (
        <FloatingWriteAction
          href={`${B_TALK_BASE_PATH}/new?audience=${audience}`}
          label={
            audience === "enthusiast"
              ? "애호가 토크 글쓰기"
              : "바리스타 토크 글쓰기"
          }
        />
      ) : null}
    </div>
  );
}

function RecipeDetailScreen({
  snapshot,
  recipeId,
}: {
  snapshot: CommunitySnapshot;
  recipeId: string;
}) {
  const router = useRouter();
  const addRecipeComment = useCommunityStore((state) => state.addRecipeComment);
  const updateRecipeCommentInStore = useCommunityStore(
    (state) => state.updateRecipeComment,
  );
  const addRecipeReply = useCommunityStore((state) => state.addRecipeReply);
  const removeRecipeCommentFromStore = useCommunityStore(
    (state) => state.removeRecipeComment,
  );
  const recipe = findBTalkByRouteId(snapshot.recipes, recipeId);
  const likeState = useCommunityStore((state) =>
    recipe ? state.recipeLikes[recipe.id] : undefined,
  );
  const toggleLike = useCommunityStore((state) => state.toggleRecipeLike);
  const setContentViewCount = useCommunityStore(
    (state) => state.setContentViewCount,
  );
  const [comment, setComment] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentLikes, setCommentLikes] = useState<
    Record<string, { liked: boolean; likes: number }>
  >({});
  const [optimisticComments, setOptimisticComments] = useState<QaComment[]>([]);
  const pendingCommentIdRef = useRef(0);
  const trackedRecipeId = recipe?.id;

  useEffect(() => {
    if (!recipe) return;
    const canonicalPath = bTalkHref(recipe.id);
    if (`${B_TALK_BASE_PATH}/${recipeId}` !== canonicalPath) {
      router.replace(canonicalPath);
    }
  }, [recipe, recipeId, router]);

  useEffect(() => {
    if (!trackedRecipeId) return;
    void trackContentView("community_b_talk", trackedRecipeId)
      .then(({ viewCount }) =>
        setContentViewCount("community_b_talk", trackedRecipeId, viewCount),
      )
      .catch(() => undefined);
  }, [trackedRecipeId, setContentViewCount]);

  if (!recipe)
    return (
      <EmptyState
        title="B-TALK 글을 찾을 수 없습니다."
        description="삭제되었거나 잘못된 주소예요."
      />
    );

  const liked = likeState?.liked ?? recipe.liked;
  const likes = likeState?.likes ?? recipe.likes;
  const images = recipeImageUrls(recipe);
  const comments = recipe.comments ?? [];
  const visibleComments = [...comments, ...optimisticComments];
  const visibleCommentCount =
    (recipe.commentCount ?? comments.length) + optimisticComments.length;
  const getCommentLike = (item: QaComment) =>
    commentLikes[item.id] ?? { liked: Boolean(item.liked), likes: item.likes };
  const toggleCommentLike = (item: QaComment) => {
    if (item.id.startsWith("pending-")) return;
    const currentLike = getCommentLike(item);
    const liked = !currentLike.liked;
    setCommentLikes((current) => ({
      ...current,
      [item.id]: {
        liked,
        likes: currentLike.likes + (liked ? 1 : -1),
      },
    }));
    void likeRecipeComment(recipe.id, item.id, liked).then(
      (result) => {
        setCommentLikes((current) => ({
          ...current,
          [item.id]: { liked: result.liked, likes: result.likes },
        }));
      },
      () => {
        setCommentLikes((current) => ({
          ...current,
          [item.id]: currentLike,
        }));
        window.alert("좋아요를 반영하지 못했습니다.");
      },
    );
  };
  const submitComment = async () => {
    if (!comment.trim() || commentSubmitting) return;

    const body = comment.trim();
    pendingCommentIdRef.current += 1;
    const optimisticComment: QaComment = {
      id: `pending-${pendingCommentIdRef.current}`,
      authorName: "나",
      createdAgo: "방금 전",
      body,
      likes: 0,
      isOwner: true,
    };
    setCommentSubmitting(true);
    setComment("");
    setOptimisticComments((current) => [...current, optimisticComment]);
    try {
      const createdComment = await createRecipeComment(recipe.id, body);
      setOptimisticComments((current) =>
        current.filter((item) => item.id !== optimisticComment.id),
      );
      addRecipeComment(recipe.id, createdComment);
    } catch {
      setOptimisticComments((current) =>
        current.filter((item) => item.id !== optimisticComment.id),
      );
      setComment(body);
      window.alert("댓글 등록에 실패했습니다.");
    } finally {
      setCommentSubmitting(false);
    }
  };

  return (
    <article className="px-5 py-7">
      <ImageDetailSlider images={images} />
      <h1 className="mt-8 text-[16px] font-bold leading-[1.35] tracking-[-0.01em]">
        {recipe.title}
      </h1>
      <DetailAuthorMeta
        name={recipe.author.name}
        date={formatRelativeTime(recipeCreatedAt(recipe))}
        avatarUrl={recipe.author.avatarUrl}
        profileHref={
          recipe.authorId
            ? buildProfileHref(
                recipe.authorId,
                `${B_TALK_BASE_PATH}/${publicBTalkId(recipe.id)}`,
              )
            : undefined
        }
        className="mt-5"
      />
      <p className="mt-6 whitespace-pre-wrap text-[12px] leading-6">
        {recipe.note}
      </p>
      <CommentThread
        comments={visibleComments}
        commentCount={visibleCommentCount}
        headerAction={
          <button
            type="button"
            aria-label={liked ? "B-TALK 좋아요 취소" : "B-TALK 좋아요"}
            onClick={async () => {
              const nextLiked = !liked;
              toggleLike(recipe.id, recipe.likes, recipe.liked);
              try {
                await likeRecipe(recipe.id, nextLiked);
              } catch {
                toggleLike(recipe.id, recipe.likes, recipe.liked);
                window.alert("관심 글 상태를 변경하지 못했습니다.");
              }
            }}
            className="flex items-center"
          >
            <LikeMeta count={likes} active={liked} />
          </button>
        }
        value={comment}
        submitting={commentSubmitting}
        getLikeState={getCommentLike}
        onToggleLike={toggleCommentLike}
        onChange={setComment}
        onSubmit={submitComment}
        onUpdate={updateRecipeCommentInStore}
        onRemove={removeRecipeCommentFromStore}
        onReply={addRecipeReply}
        requestUpdate={updateRecipeComment}
        requestDelete={deleteRecipeComment}
        requestReply={createRecipeReply}
        contentId={recipe.id}
      />
    </article>
  );
}

function RecipeCreateScreen({ snapshot }: { snapshot: CommunitySnapshot }) {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const audienceParam = searchParams.get("audience");
  const audience: TalkAudience =
    audienceParam === "enthusiast" || audienceParam === "barista"
      ? audienceParam
      : defaultTalkAudienceForRole(snapshot.viewerRole);
  const editRecipe = editId
    ? snapshot.recipes.find((recipe) => recipe.id === editId)
    : undefined;
  const [title, setTitle] = useState(editRecipe?.title ?? "");
  const [journal, setJournal] = useState(editRecipe?.note ?? "");
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>(() =>
    (editRecipe ? recipeImageUrls(editRecipe) : []).map(
      createExistingAttachedImage,
    ),
  );
  const { startImageCrop, imageCropEditor } = useImageCropFlow((files) => {
    setAttachedImages((current) =>
      mergeCommunityImageAttachments(current, files.map(createAttachedImage)),
    );
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useAttachedImageCleanup(attachedImages);
  const roast = editRecipe?.roast ?? "medium";
  const origin = editRecipe?.bean.origin ?? "B-TALK";
  const process = editRecipe?.bean.process ?? "Chat";
  const roastPoint = editRecipe?.bean.roastPoint ?? "50";
  const dosing = editRecipe?.extraction.dosing ?? "18g";
  const yieldAmount = editRecipe?.extraction.yield ?? "36g";
  const time = editRecipe?.extraction.time ?? "28s";
  const temp = editRecipe?.extraction.temp ?? "93°C";

  const submit = async () => {
    if (!title.trim() || !journal.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const uploadedImageUrls =
        attachedImages.length > 0
          ? await uploadImages(
              attachedImageFiles(attachedImages),
              "community/b-talk",
            )
          : [];
      const { coverUrl, imageUrls } = buildCommunityImagePayload({
        uploadedImageUrls,
        existingImageUrls: existingAttachedImageUrls(attachedImages),
      });
      const input = {
        audience,
        title: title.trim(),
        roast,
        note: journal.trim(),
        coverUrl,
        processImages: imageUrls,
        origin,
        process,
        roastPoint,
        dosing,
        yield: yieldAmount,
        time,
        temp,
      };
      if (editRecipe) {
        await updateRecipe(editRecipe.id, input);
        window.location.replace(B_TALK_BASE_PATH);
        return;
      }
      const recipe = await createRecipe(input);
      window.location.assign(bTalkHref(recipe.id));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : `B-TALK 글 ${editRecipe ? "수정" : "등록"}에 실패했습니다.`,
      );
      setSubmitting(false);
    }
  };

  const attachImageFiles = (files: File[]) => {
    if (files.length === 0) return;

    const remaining = remainingCommunityImageAttachmentCount(
      attachedImages.length,
    );
    if (remaining <= 0) {
      setError(
        `이미지는 최대 ${COMMUNITY_IMAGE_ATTACHMENT_LIMIT}장까지 첨부할 수 있습니다.`,
      );
      return;
    }

    if (files.length > remaining) {
      setError(`이미지는 ${remaining}장만 더 첨부할 수 있습니다.`);
    }

    const validFiles = filterImageFiles(
      files.slice(0, remaining),
      COMMUNITY_IMAGE_LIMIT,
      setError,
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
          const remaining = remainingCommunityImageAttachmentCount(
            attachedImages.length,
          );
          const files = await pickNativeImageFiles(remaining);
          attachImageFiles(files ?? []);
        } catch {
          setError("이미지 선택에 실패했습니다. 다시 시도해주세요.");
        }
      }
    : undefined;

  return (
    <>
      {imageCropEditor}
      <FormPage title={editRecipe ? "B-TALK 수정하기" : "B-TALK 등록하기"}>
        <FieldGroup title="제목">
          <SimpleInput
            name="bTalkTitle"
            value={title}
            onChange={setTitle}
            placeholder="제목을 입력하세요"
          />
        </FieldGroup>
        <FloatingTextarea
          label="내용"
          value={journal}
          onChange={setJournal}
          maxLength={500}
          rows={9}
        />
        <CommunityImageUploadSection
          attachedImages={attachedImages}
          inputNamePrefix="bTalk"
          ariaPrefix="B-TALK"
          onAttachImages={attachImages}
          onOpenNativePicker={openNativeImagePicker}
          onRemoveImage={(image) => {
            revokeAttachedImages([image]);
            setAttachedImages((current) =>
              current.filter((item) => item.id !== image.id),
            );
          }}
        />
        {error ? (
          <p className="text-[13px] font-bold text-[var(--danger)]">{error}</p>
        ) : null}
        <Button
          type="button"
          disabled={!title.trim() || !journal.trim() || submitting}
          onClick={submit}
        >
          {submitting
            ? "저장 중..."
            : editRecipe
              ? "B-TALK 수정하기"
              : "등록하기"}
        </Button>
      </FormPage>
    </>
  );
}

function QaListScreen({ snapshot }: { snapshot: CommunitySnapshot }) {
  const [page, setPage] = useState(1);
  const items = paginate(snapshot.qaPosts, page, 10);

  return (
    <div className="relative min-h-[calc(100dvh-128px)] pb-28">
      <div className="divide-y divide-[var(--border)] px-5 pt-2">
        {items.map((post) => (
          <QaRow key={post.id} post={post} />
        ))}
      </div>
      {snapshot.qaPosts.length === 0 ? (
        <EmptyState
          title="등록된 질문이 없습니다."
          description="커피와 커리어에 대한 첫 질문을 남겨보세요."
        />
      ) : null}
      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(snapshot.qaPosts.length / 10))}
        onChange={setPage}
        className="mt-8"
      />
      <FloatingWriteAction href="/community/qa/new" label="Q&A 글쓰기" />
    </div>
  );
}

function QaDetailScreen({
  snapshot,
  postId,
}: {
  snapshot: CommunitySnapshot;
  postId: string;
}) {
  const addQaComment = useCommunityStore((state) => state.addQaComment);
  const addQaReply = useCommunityStore((state) => state.addQaReply);
  const updateQaCommentInStore = useCommunityStore(
    (state) => state.updateQaComment,
  );
  const removeQaCommentFromStore = useCommunityStore(
    (state) => state.removeQaComment,
  );
  const setContentViewCount = useCommunityStore(
    (state) => state.setContentViewCount,
  );
  const likeState = useCommunityStore((state) => state.qaLikes[postId]);
  const toggleLike = useCommunityStore((state) => state.toggleQaLike);
  const post = snapshot.qaPosts.find((item) => item.id === postId);
  const [comment, setComment] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentLikes, setCommentLikes] = useState<
    Record<string, { liked: boolean; likes: number }>
  >({});
  const [optimisticComments, setOptimisticComments] = useState<QaComment[]>([]);
  const pendingCommentIdRef = useRef(0);
  const trackedPostId = post?.id;

  useEffect(() => {
    if (!trackedPostId) return;
    void trackContentView("community_qa", trackedPostId)
      .then(({ viewCount }) =>
        setContentViewCount("community_qa", trackedPostId, viewCount),
      )
      .catch(() => undefined);
  }, [trackedPostId, setContentViewCount]);

  if (!post)
    return (
      <EmptyState
        title="질문을 찾을 수 없습니다."
        description="삭제되었거나 잘못된 주소예요."
      />
    );

  const getCommentLike = (item: QaComment) =>
    commentLikes[item.id] ?? { liked: Boolean(item.liked), likes: item.likes };
  const visibleComments = [...post.comments, ...optimisticComments];
  const visibleCommentCount = post.commentCount + optimisticComments.length;
  const images = qaImageUrls(post);
  const liked = likeState?.liked ?? post.liked ?? false;
  const likes = likeState?.likes ?? post.likes;
  const toggleCommentLike = (item: QaComment) => {
    if (item.id.startsWith("pending-")) return;
    const currentLike = getCommentLike(item);
    const nextLiked = !currentLike.liked;
    setCommentLikes((current) => ({
      ...current,
      [item.id]: {
        liked: nextLiked,
        likes: currentLike.likes + (nextLiked ? 1 : -1),
      },
    }));
    void likeQaComment(post.id, item.id, nextLiked).then(
      (result) => {
        setCommentLikes((current) => ({
          ...current,
          [item.id]: { liked: result.liked, likes: result.likes },
        }));
      },
      () => {
        setCommentLikes((current) => ({
          ...current,
          [item.id]: currentLike,
        }));
        window.alert("좋아요를 반영하지 못했습니다.");
      },
    );
  };
  const submitComment = async () => {
    if (!comment.trim() || commentSubmitting) return;

    const body = comment.trim();
    pendingCommentIdRef.current += 1;
    const optimisticComment: QaComment = {
      id: `pending-${pendingCommentIdRef.current}`,
      authorName: "나",
      createdAgo: "방금 전",
      body,
      likes: 0,
      isOwner: true,
    };
    setCommentSubmitting(true);
    setComment("");
    setOptimisticComments((current) => [...current, optimisticComment]);
    try {
      const createdComment = await createQaComment(post.id, body);
      setOptimisticComments((current) =>
        current.filter((item) => item.id !== optimisticComment.id),
      );
      addQaComment(post.id, createdComment);
    } catch {
      setOptimisticComments((current) =>
        current.filter((item) => item.id !== optimisticComment.id),
      );
      setComment(body);
      window.alert("댓글 등록에 실패했습니다.");
    } finally {
      setCommentSubmitting(false);
    }
  };
  return (
    <article className="px-5 py-7">
      <ImageDetailSlider images={images} />
      <h1 className="mt-8 text-[16px] font-bold leading-[1.35] tracking-[-0.01em]">
        {post.title}
      </h1>
      <DetailAuthorMeta
        name={post.authorName}
        date={formatRelativeTime(post.createdAt, post.createdAgo)}
        avatarUrl={post.authorAvatarUrl}
        isBarista={Boolean(post.isBarista || post.authorRole === "barista")}
        profileHref={
          post.authorId
            ? post.isBarista || post.authorRole === "barista"
              ? `/showroom/${encodeURIComponent(post.authorId)}`
              : buildProfileHref(post.authorId, `/community/qa/${post.id}`)
            : undefined
        }
        className="mt-5"
      />
      <p className="mt-6 text-[12px] leading-6">{post.body}</p>
      <CommentThread
        comments={visibleComments}
        commentCount={visibleCommentCount}
        headerAction={
          <button
            type="button"
            aria-label={liked ? "Q&A 좋아요 취소" : "Q&A 좋아요"}
            onClick={() => {
              const nextLiked = !liked;
              toggleLike(post.id, post.likes, post.liked);
              void likeQaPost(post.id, nextLiked).catch(() => {
                toggleLike(post.id, post.likes, post.liked);
                window.alert("관심 글 상태를 변경하지 못했습니다.");
              });
            }}
            className="flex items-center"
          >
            <LikeMeta count={likes} active={liked} />
          </button>
        }
        value={comment}
        submitting={commentSubmitting}
        getLikeState={getCommentLike}
        onToggleLike={toggleCommentLike}
        onChange={setComment}
        onSubmit={submitComment}
        onUpdate={updateQaCommentInStore}
        onRemove={removeQaCommentFromStore}
        onReply={addQaReply}
        requestUpdate={updateQaComment}
        requestDelete={deleteQaComment}
        requestReply={createQaReply}
        contentId={post.id}
      />
    </article>
  );
}

function QaCreateScreen({ snapshot }: { snapshot: CommunitySnapshot }) {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const editPost = editId
    ? snapshot.qaPosts.find((post) => post.id === editId)
    : undefined;
  const [title, setTitle] = useState(editPost?.title ?? "");
  const [body, setBody] = useState(editPost?.body ?? "");
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>(() =>
    (editPost ? qaImageUrls(editPost) : []).map(createExistingAttachedImage),
  );
  const { startImageCrop, imageCropEditor } = useImageCropFlow((files) => {
    setAttachedImages((current) =>
      mergeCommunityImageAttachments(current, files.map(createAttachedImage)),
    );
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useAttachedImageCleanup(attachedImages);

  const submit = async () => {
    if (!title.trim() || !body.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const uploadedImageUrls =
        attachedImages.length > 0
          ? await uploadImages(
              attachedImageFiles(attachedImages),
              "community/qa",
            )
          : [];
      const { imageUrl, imageUrls } = buildCommunityImagePayload({
        uploadedImageUrls,
        existingImageUrls: existingAttachedImageUrls(attachedImages),
      });
      if (editPost) {
        await updateQaPost(editPost.id, {
          title: title.trim(),
          body: body.trim(),
          imageUrl,
          imageUrls,
        });
        window.location.replace("/community/qa");
        return;
      }
      const post = await createQaPost({
        title: title.trim(),
        body: body.trim(),
        imageUrl,
        imageUrls,
      });
      window.location.assign(`/community/qa/${post.id}`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : `질문 ${editPost ? "수정" : "등록"}에 실패했습니다.`,
      );
      setSubmitting(false);
    }
  };

  const attachImageFiles = (files: File[]) => {
    if (files.length === 0) return;

    const remaining = remainingCommunityImageAttachmentCount(
      attachedImages.length,
    );
    if (remaining <= 0) {
      setError(
        `이미지는 최대 ${COMMUNITY_IMAGE_ATTACHMENT_LIMIT}장까지 첨부할 수 있습니다.`,
      );
      return;
    }

    if (files.length > remaining) {
      setError(`이미지는 ${remaining}장만 더 첨부할 수 있습니다.`);
    }

    const validFiles = filterImageFiles(
      files.slice(0, remaining),
      COMMUNITY_IMAGE_LIMIT,
      setError,
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
          const remaining = remainingCommunityImageAttachmentCount(
            attachedImages.length,
          );
          const files = await pickNativeImageFiles(remaining);
          attachImageFiles(files ?? []);
        } catch {
          setError("이미지 선택에 실패했습니다. 다시 시도해주세요.");
        }
      }
    : undefined;

  return (
    <>
      {imageCropEditor}
      <FormPage title={editPost ? "질문 수정하기" : "질문 등록하기"}>
        <FieldGroup title="제목">
          <SimpleInput
            name="qaTitle"
            value={title}
            onChange={setTitle}
            placeholder="제목을 입력하세요"
          />
        </FieldGroup>
        <FloatingTextarea
          label="내용"
          value={body}
          onChange={setBody}
          maxLength={500}
          rows={9}
        />
        <CommunityImageUploadSection
          attachedImages={attachedImages}
          inputNamePrefix="qa"
          ariaPrefix="Q&A"
          onAttachImages={attachImages}
          onOpenNativePicker={openNativeImagePicker}
          onRemoveImage={(image) => {
            revokeAttachedImages([image]);
            setAttachedImages((current) =>
              current.filter((item) => item.id !== image.id),
            );
          }}
        />
        {error ? (
          <p className="text-[13px] font-bold text-[var(--danger)]">{error}</p>
        ) : null}
        <Button
          type="button"
          disabled={!title.trim() || !body.trim() || submitting}
          onClick={submit}
        >
          {submitting ? "저장 중..." : editPost ? "질문 수정하기" : "등록하기"}
        </Button>
      </FormPage>
    </>
  );
}

function CommunityImageUploadSection({
  attachedImages,
  inputNamePrefix,
  ariaPrefix,
  onAttachImages,
  onOpenNativePicker,
  onRemoveImage,
}: {
  attachedImages: AttachedImage[];
  inputNamePrefix: string;
  ariaPrefix: string;
  onAttachImages: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenNativePicker?: () => void;
  onRemoveImage: (image: AttachedImage) => void;
}) {
  return (
    <ImageAttachmentSection
      images={attachedImages}
      limit={COMMUNITY_IMAGE_ATTACHMENT_LIMIT}
      accept={IMAGE_ACCEPT}
      inputName={`${inputNamePrefix}Images`}
      ariaPrefix={ariaPrefix}
      onAttachImages={onAttachImages}
      onOpenNativePicker={onOpenNativePicker}
      onRemoveImage={onRemoveImage}
    />
  );
}

function EventRow({ event }: { event: CommunityEvent }) {
  return (
    <Link
      prefetch={false}
      href={`/community/events/${event.id}`}
      className="grid grid-cols-[84px_1fr] gap-4"
    >
      <HeroImage
        src={event.imageUrl}
        className="h-[84px] rounded-[var(--radius-sm)]"
      />
      <div className="min-w-0 pt-1">
        <h3 className="truncate text-[16px] font-bold leading-snug">
          <span className={cn("hl", categoryMeta[event.category].hl)}>
            {event.title}
          </span>
        </h3>
        <p className="mt-2 text-[12px] text-[var(--fg-muted)]">
          {formatEventRange(event)}
        </p>
        <p className="mt-1 flex items-center gap-1 truncate text-[12px] text-[var(--fg-muted)]">
          <MapPin size={15} /> {event.location}
        </p>
      </div>
    </Link>
  );
}

function EventListCard({ event }: { event: CommunityEvent }) {
  return <EventRow event={event} />;
}

function ReviewTeaser({ review }: { review: EventReview }) {
  return (
    <Link
      prefetch={false}
      href={`/community/reviews/${review.id}`}
      className="grid grid-cols-[84px_minmax(0,1fr)] gap-4"
    >
      <HeroImage
        src={review.imageUrls[0]}
        className="h-[84px] rounded-[var(--radius-sm)]"
        fallbackIcon={<Heart size={18} />}
      />
      <div className="min-w-0">
        <h3 className="line-clamp-2 text-[16px] font-bold leading-snug">
          <span className={cn("hl", categoryMeta[review.category].hl)}>
            {review.title}
          </span>
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {safeKeywords(review.keywords).map((keyword) => (
            <span
              key={keyword}
              className="rounded-[var(--radius-sm)] bg-[var(--surface-alt)] px-2 py-1 text-[12px] text-[var(--fg-muted)]"
            >
              {keyword}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

function ReviewListCard({ review }: { review: EventReview }) {
  return <ReviewTeaser review={review} />;
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const likeState = useCommunityStore((state) => state.recipeLikes[recipe.id]);
  const likes = likeState?.likes ?? recipe.likes;
  const href = bTalkHref(recipe.id);
  const [thumbnailUrl] = recipeImageUrls(recipe);

  return (
    <article className="py-2">
      <div
        className={cn(
          "grid items-center gap-x-4",
          thumbnailUrl && "grid-cols-[minmax(0,1fr)_64px]",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-col justify-center gap-1",
            thumbnailUrl && "min-h-[64px]",
          )}
        >
          <Link prefetch={false} href={href} className="min-w-0">
            <h2 className="line-clamp-2 text-[16px] font-bold leading-[1.35] tracking-[-0.01em] text-[var(--fg-strong)]">
              {recipe.title}
            </h2>
          </Link>
          <QaRowMeta
            href={href}
            authorName={recipe.author.name}
            createdAgo={formatRelativeTime(recipeCreatedAt(recipe))}
            likes={likes}
            commentCount={recipe.commentCount ?? recipe.comments?.length ?? 0}
            viewCount={recipe.viewCount}
          />
        </div>
        {thumbnailUrl ? (
          <Link
            prefetch={false}
            href={href}
            className="block h-[64px] w-[64px] overflow-hidden rounded-[var(--radius-sm)] bg-[var(--surface-alt)]"
          >
            <Image
              src={thumbnailUrl}
              alt=""
              width={208}
              height={208}
              sizes="64px"
              className="h-full w-full object-cover"
            />
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function QaRow({ post }: { post: QaPost }) {
  const likeState = useCommunityStore((state) => state.qaLikes[post.id]);
  const likes = likeState?.likes ?? post.likes;
  const href = `/community/qa/${post.id}`;
  const [thumbnailUrl] = qaImageUrls(post);

  return (
    <article className="py-2">
      <div
        className={cn(
          "grid items-center gap-x-4",
          thumbnailUrl && "grid-cols-[minmax(0,1fr)_64px]",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-col justify-center gap-1",
            thumbnailUrl && "min-h-[64px]",
          )}
        >
          <Link prefetch={false} href={href} className="min-w-0">
            <h2 className="line-clamp-2 text-[16px] font-bold leading-[1.35] tracking-[-0.01em] text-[var(--fg-strong)]">
              {post.title}
            </h2>
          </Link>
          <QaRowMeta
            href={href}
            authorName={post.authorName}
            createdAgo={formatRelativeTime(post.createdAt, post.createdAgo)}
            likes={likes}
            commentCount={post.commentCount}
            viewCount={post.viewCount}
          />
        </div>
        {thumbnailUrl ? (
          <Link
            prefetch={false}
            href={href}
            className="block h-[64px] w-[64px] overflow-hidden rounded-[var(--radius-sm)] bg-[var(--surface-alt)]"
          >
            <Image
              src={thumbnailUrl}
              alt=""
              width={208}
              height={208}
              sizes="64px"
              className="h-full w-full object-cover"
            />
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function QaRowMeta({
  href,
  authorName,
  createdAgo,
  likes,
  commentCount,
  viewCount,
}: {
  href: string;
  authorName: string;
  createdAgo: string;
  likes: number;
  commentCount: number;
  viewCount: number;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 leading-[1.5]">
      <Link
        prefetch={false}
        href={href}
        className="truncate text-[12px] text-[var(--fg-muted)]"
      >
        {authorName}
      </Link>
      <div className="flex min-w-0 items-center gap-1 overflow-hidden text-[var(--fg-subtle)]">
        <span className="shrink-0 text-[12px] leading-none text-[var(--fg-muted)]">
          {createdAgo}
        </span>
        <span
          aria-label={`조회수 ${formatCompactCount(viewCount)}`}
          className="grid h-4 shrink-0 grid-cols-[14px_auto] items-center gap-0.5 whitespace-nowrap leading-none"
        >
          <Eye size={14} strokeWidth={1.75} className="shrink-0" aria-hidden />
          <span className="text-[12px] leading-none tabular-nums text-[var(--fg-muted)]">
            {formatCompactCount(viewCount)}
          </span>
        </span>
        <span className="grid h-4 shrink-0 grid-cols-[14px_auto] items-center gap-0.5 whitespace-nowrap leading-none">
          <MessageSquare
            size={14}
            strokeWidth={1.75}
            className="shrink-0"
            aria-hidden
          />
          <span className="text-[12px] leading-none tabular-nums text-[var(--fg-muted)]">
            {formatCompactCount(commentCount)}
          </span>
        </span>
        <span
          aria-label={`좋아요 ${formatCompactCount(likes)}`}
          className="grid h-4 shrink-0 grid-cols-[14px_auto] items-center gap-0.5 whitespace-nowrap leading-none"
        >
          <Heart
            size={14}
            strokeWidth={1.75}
            className="shrink-0"
            aria-hidden
          />
          <span className="text-[12px] leading-none tabular-nums text-[var(--fg-muted)]">
            {formatCompactCount(likes)}
          </span>
        </span>
      </div>
    </div>
  );
}

function LikeMeta({
  count,
  active = false,
  className,
}: {
  count: number;
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid grid-cols-[17px_auto] items-center gap-1 whitespace-nowrap leading-none",
        active ? "text-[var(--accent)]" : "text-[var(--fg-subtle)]",
        className,
      )}
    >
      <Heart
        size={17}
        strokeWidth={2}
        className="shrink-0"
        fill={active ? "var(--accent)" : "none"}
      />
      <span className="text-[12px] leading-none tabular-nums text-[var(--fg-muted)]">
        {formatCompactCount(count)}
      </span>
    </span>
  );
}

function Legend({
  compact = false,
  active = "all",
  onSelect,
}: {
  compact?: boolean;
  active?: CategoryFilter;
  onSelect?: (category: CategoryFilter) => void;
}) {
  const filterItems: Array<{
    value: CategoryFilter;
    label: string;
    dot: string;
  }> = [
    ...(onSelect
      ? [{ value: "all" as const, label: "전체", dot: "bg-[var(--fg-faint)]" }]
      : []),
    ...(Object.keys(categoryMeta) as EventCategory[]).map((category) => ({
      value: category,
      label: categoryMeta[category].label,
      dot: categoryMeta[category].dot,
    })),
  ];

  return (
    <div className={cn("flex items-center gap-3", compact && "gap-2")}>
      {filterItems.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onSelect?.(item.value)}
          className={cn(
            "flex items-center gap-1.5 rounded-[var(--radius-pill)] px-1 py-1 text-[11px] text-[var(--fg)]",
            active === item.value && "bg-[var(--surface-alt)] font-bold",
          )}
        >
          <span
            className={cn("h-2.5 w-2.5 rounded-[var(--radius-pill)]", item.dot)}
          />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function CategoryChips({
  value,
  onChange,
  rounded = false,
}: {
  value: EventCategory;
  onChange: (value: EventCategory) => void;
  rounded?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {(Object.keys(categoryMeta) as EventCategory[]).map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => onChange(category)}
          className={cn(
            "border px-3 py-3 text-[12px] transition",
            rounded
              ? "rounded-[var(--radius-pill)]"
              : "rounded-[var(--radius-md)]",
            categoryMeta[category].chip,
            value === category ? "font-bold" : "font-medium",
            value !== category && "bg-transparent",
          )}
        >
          {category === "official"
            ? "공식 일정"
            : category === "seminar"
              ? "소규모 세미나"
              : "비공식 모임"}
        </button>
      ))}
    </div>
  );
}

function SectionHeader({
  title,
  href,
  className,
}: {
  title: string;
  href: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-[var(--border)] pb-3",
        className,
      )}
    >
      <h2 className="text-[17px] font-bold tracking-[0.16em] text-[var(--fg-strong)]">
        {title}
      </h2>
      <Link
        prefetch={false}
        href={href}
        aria-label={`${title} 전체 보기`}
        className="flex h-9 w-9 items-center justify-center text-[var(--fg-muted)]"
      >
        <Plus size={24} />
      </Link>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
  className,
  withArrows = false,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
  withArrows?: boolean;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from(
    { length: Math.min(totalPages, 5) },
    (_, index) => index + 1,
  );
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-7 text-[14px]",
        className,
      )}
    >
      {withArrows ? (
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="text-[var(--fg-faint)] disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>
      ) : null}
      {pages.map((item) => (
        <button
          type="button"
          key={item}
          onClick={() => onChange(item)}
          className={cn(
            item === page
              ? "font-bold text-[var(--accent)]"
              : "text-[var(--fg-muted)]",
          )}
        >
          {item}
        </button>
      ))}
      {totalPages > 5 ? (
        <span className="text-[var(--fg-muted)]">...</span>
      ) : null}
    </div>
  );
}

function SecondaryButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      prefetch={false}
      href={href}
      className="flex w-full items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-strong)] px-7 py-5 text-[18px] font-bold text-[var(--fg)]"
    >
      {children}
    </Link>
  );
}

function HeroImage({
  src,
  className,
  fallbackIcon,
}: {
  src?: string;
  className?: string;
  fallbackIcon?: ReactNode;
}) {
  if (!src) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center bg-[var(--border-strong)] text-[var(--fg-muted)]",
          className,
        )}
      >
        {fallbackIcon ?? <Camera size={24} />}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt=""
      width={900}
      height={675}
      sizes="(max-width: 480px) 100vw, 480px"
      className={cn("w-full object-cover", className)}
      onError={(event) => (event.currentTarget.style.display = "none")}
    />
  );
}

function FormPage({
  title,
  description,
  titleClassName,
  children,
}: {
  title?: string;
  description?: string;
  titleClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-8 px-6 py-8">
      {title ? (
        <div>
          <h1
            className={cn(
              "text-[16px] font-bold leading-[1.35] tracking-[-0.01em] text-[var(--fg-strong)]",
              titleClassName,
            )}
          >
            {title}
          </h1>
          {description ? (
            <p className="mt-4 text-[12px] leading-6 text-[var(--fg-muted)]">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function FloatingInput({
  label,
  defaultValue,
  value,
  onChange,
  placeholder,
  type = "text",
  name,
}: {
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  name?: string;
}) {
  return (
    <label className="block rounded-[var(--radius-md)] border border-[var(--border-strong)] px-5 pb-4 pt-5 focus-within:border-[var(--accent)]">
      <span className="block text-[12px] text-[var(--fg-muted)]">{label}</span>
      <input
        type={type}
        name={name ?? label}
        defaultValue={defaultValue}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full bg-transparent text-[16px] outline-none placeholder:text-[var(--fg-subtle)]"
      />
    </label>
  );
}

function FloatingTextarea({
  label,
  value,
  onChange,
  maxLength,
  rows,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  rows: number;
  placeholder?: string;
}) {
  return (
    <label className="block rounded-[var(--radius-md)] border border-[var(--border-strong)] px-5 pb-4 pt-5 focus-within:border-[var(--accent)]">
      <span className="flex items-center justify-between text-[12px] text-[var(--fg-muted)]">
        {label}
        <span>
          {value.length}/{maxLength}
        </span>
      </span>
      <textarea
        name={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        rows={rows}
        placeholder={placeholder}
        className="mt-3 w-full resize-none bg-transparent text-[12px] leading-6 outline-none placeholder:text-[var(--fg-subtle)]"
      />
    </label>
  );
}

function FieldGroup({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[16px] font-bold tracking-[-0.01em] text-[var(--fg)]">
          {title}
        </h2>
        {aside ? (
          <span className="text-[13px] text-[var(--fg-subtle)]">{aside}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ScheduleEditor({
  startDate,
  startTime,
  endDate,
  endTime,
  allDay,
  onAllDayChange,
  onStartDateChange,
  onStartTimeChange,
  onEndDateChange,
  onEndTimeChange,
}: {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
  onAllDayChange: (value: boolean) => void;
  onStartDateChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
}) {
  return (
    <FieldGroup title="일정">
      <label className="flex items-center justify-between py-1 text-[16px] text-[var(--fg)]">
        <span>종일</span>
        <input
          type="checkbox"
          checked={allDay}
          onChange={(event) => onAllDayChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="relative h-6 w-11 rounded-[var(--radius-pill)] bg-[var(--fg-faint)] transition peer-checked:bg-[var(--accent)] after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-[var(--radius-pill)] after:border after:border-[var(--border-strong)] after:bg-[var(--surface)] after:transition peer-checked:after:translate-x-5" />
      </label>
      <div className="mt-4 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
        <ScheduleRow
          label="시작"
          date={startDate}
          time={startTime}
          allDay={allDay}
          onDateChange={onStartDateChange}
          onTimeChange={onStartTimeChange}
        />
        <ScheduleRow
          label="종료"
          date={endDate}
          time={endTime}
          allDay={allDay}
          onDateChange={onEndDateChange}
          onTimeChange={onEndTimeChange}
          bordered
        />
      </div>
    </FieldGroup>
  );
}

function ScheduleRow({
  label,
  date,
  time,
  allDay,
  onDateChange,
  onTimeChange,
  bordered = false,
}: {
  label: string;
  date: string;
  time: string;
  allDay: boolean;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  bordered?: boolean;
}) {
  const [picker, setPicker] = useState<SchedulePickerKind | null>(null);

  return (
    <>
      <div
        className={cn(
          "grid min-h-14 grid-cols-[40px_minmax(0,1fr)_112px] items-center gap-2 px-4",
          bordered && "border-t border-[var(--border)]",
        )}
      >
        <span className="text-[14px] text-[var(--fg-muted)]">{label}</span>
        <div className={cn("min-w-0", allDay && "col-span-2")}>
          <button
            type="button"
            aria-label={`${label} 날짜 선택`}
            onClick={() => setPicker("date")}
            className="flex h-12 w-full min-w-0 cursor-pointer items-center rounded-[var(--radius-md)] bg-[var(--surface-alt)] px-3 text-left text-[14px] text-[var(--fg)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
          >
            {formatEventDate(date)}
          </button>
        </div>
        {!allDay ? (
          <button
            type="button"
            aria-label={`${label} 시간 선택`}
            onClick={() => setPicker("time")}
            className="flex h-12 w-full cursor-pointer items-center justify-start whitespace-nowrap rounded-[var(--radius-md)] bg-[var(--surface-alt)] px-3 text-left text-[14px] text-[var(--fg)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
          >
            {formatEventTime(time)}
          </button>
        ) : null}
      </div>
      {picker ? (
        <SchedulePickerSheet
          kind={picker}
          date={date}
          time={time}
          onClose={() => setPicker(null)}
          onDateChange={(value) => {
            onDateChange(value);
            setPicker(allDay ? null : "time");
          }}
          onTimeChange={onTimeChange}
        />
      ) : null}
    </>
  );
}

type SchedulePickerKind = "date" | "time";

const scheduleWeekdays = ["일", "월", "화", "수", "목", "금", "토"];

function dateFromValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(
    Number.isFinite(year) ? year : new Date().getFullYear(),
    Number.isFinite(month) ? month - 1 : new Date().getMonth(),
    Number.isFinite(day) ? day : new Date().getDate(),
  );
}

function dateValueFromDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function monthStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function calendarDaysForMonth(value: Date) {
  const firstDay = monthStart(value);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(
    firstDay.getFullYear(),
    firstDay.getMonth() + 1,
    0,
  ).getDate();
  return Array.from({ length: startOffset + daysInMonth }, (_, index) =>
    index < startOffset
      ? null
      : new Date(
          firstDay.getFullYear(),
          firstDay.getMonth(),
          index - startOffset + 1,
        ),
  );
}

function SchedulePickerSheet({
  kind,
  date,
  time,
  onClose,
  onDateChange,
  onTimeChange,
}: {
  kind: SchedulePickerKind;
  date: string;
  time: string;
  onClose: () => void;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}) {
  const [visibleMonth, setVisibleMonth] = useState(() =>
    monthStart(dateFromValue(date)),
  );
  const [draftTime, setDraftTime] = useState(time);

  const selectedDate = dateFromValue(date);
  const selectedDateValue = dateValueFromDate(selectedDate);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 bg-black/20"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={kind === "date" ? "날짜 선택" : "시간 선택"}
        className="absolute inset-x-0 bottom-0 mx-auto max-w-[var(--app-shell-max-width)] rounded-t-[var(--radius-xl)] bg-[var(--surface)] px-4 pb-[calc(var(--app-safe-area-bottom)+16px)] pt-3 shadow-[var(--shadow-modal)]"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="mx-auto mb-3 block h-1 w-10 rounded-[var(--radius-pill)] bg-[var(--border-strong)]" />
        <div className="flex h-12 items-center justify-between border-b border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-2 text-[15px] text-[var(--fg-muted)]"
          >
            취소
          </button>
          <strong className="text-[16px] text-[var(--fg)]">
            {kind === "date" ? "날짜 선택" : "시간 선택"}
          </strong>
          <button
            type="button"
            onClick={() => {
              if (kind === "time") onTimeChange(draftTime);
              onClose();
            }}
            className="h-11 px-2 text-[15px] font-bold text-[var(--accent)]"
          >
            완료
          </button>
        </div>

        {kind === "date" ? (
          <div className="pt-4">
            <div className="mb-3 flex items-center justify-between px-1">
              <button
                type="button"
                aria-label="이전 달"
                onClick={() =>
                  setVisibleMonth(
                    new Date(
                      visibleMonth.getFullYear(),
                      visibleMonth.getMonth() - 1,
                      1,
                    ),
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] text-[var(--fg-muted)]"
              >
                <ChevronLeft size={20} />
              </button>
              <strong className="text-[16px] text-[var(--fg)]">
                {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
              </strong>
              <button
                type="button"
                aria-label="다음 달"
                onClick={() =>
                  setVisibleMonth(
                    new Date(
                      visibleMonth.getFullYear(),
                      visibleMonth.getMonth() + 1,
                      1,
                    ),
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] text-[var(--fg-muted)]"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="grid grid-cols-7 text-center text-[12px] text-[var(--fg-subtle)]">
              {scheduleWeekdays.map((weekday) => (
                <span key={weekday} className="py-2">
                  {weekday}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {calendarDaysForMonth(visibleMonth).map((day, index) => {
                if (!day)
                  return <span key={`empty-${index}`} className="h-11" />;
                const value = dateValueFromDate(day);
                const selected = value === selectedDateValue;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onDateChange(value)}
                    className={cn(
                      "mx-auto flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] text-[14px] text-[var(--fg)]",
                      selected && "bg-[var(--accent)] font-bold text-white",
                    )}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <TimePickerFields value={draftTime} onChange={setDraftTime} />
        )}
      </section>
    </div>
  );
}

function TimePickerFields({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const currentHour = match ? Number(match[1]) : 9;
  const currentMinute = match ? Number(match[2]) : 0;
  const period = currentHour >= 12 ? "오후" : "오전";
  const hour = currentHour % 12 || 12;

  const update = (nextPeriod: string, nextHour: number, nextMinute: number) => {
    const hour24 = (nextHour % 12) + (nextPeriod === "오후" ? 12 : 0);
    onChange(
      `${String(hour24).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`,
    );
  };

  return (
    <div className="relative px-2 pb-4 pt-6">
      <div className="pointer-events-none absolute inset-x-2 top-1/2 h-12 -translate-y-1/2 rounded-[var(--radius-md)] border-y border-[var(--border-strong)]" />
      <div className="relative grid grid-cols-[1fr_1fr_1fr] items-center gap-2">
        <WheelColumn
          ariaLabel="오전 오후"
          options={["오전", "오후"]}
          value={period}
          onChange={(value) => update(value, hour, currentMinute)}
        />
        <WheelColumn
          ariaLabel="시"
          options={Array.from({ length: 12 }, (_, index) => String(index + 1))}
          value={String(hour)}
          onChange={(value) => update(period, Number(value), currentMinute)}
        />
        <WheelColumn
          ariaLabel="분"
          options={Array.from({ length: 60 }, (_, minute) =>
            String(minute).padStart(2, "0"),
          )}
          value={String(currentMinute).padStart(2, "0")}
          onChange={(value) => update(period, hour, Number(value))}
        />
      </div>
      <p className="mt-3 text-center text-[12px] text-[var(--fg-subtle)]">
        오전/오후, 시, 분을 선택하세요
      </p>
    </div>
  );
}

function WheelColumn({
  ariaLabel,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(0, options.indexOf(value));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: selectedIndex * 48 });
  }, [selectedIndex]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const nextIndex = Math.min(
      options.length - 1,
      Math.max(0, Math.round(element.scrollTop / 48)),
    );
    const nextValue = options[nextIndex];
    if (nextValue && nextValue !== value) onChange(nextValue);
  };

  return (
    <div className="relative min-w-0">
      <div
        ref={scrollRef}
        role="listbox"
        aria-label={ariaLabel}
        tabIndex={0}
        onScroll={handleScroll}
        className="h-36 snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-[var(--radius-md)] bg-[var(--surface-alt)] px-1 py-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="option"
            aria-selected={option === value}
            onClick={() => {
              onChange(option);
              scrollRef.current?.scrollTo({
                top: options.indexOf(option) * 48,
                behavior: "smooth",
              });
            }}
            className={cn(
              "flex h-12 w-full snap-center items-center justify-center text-[18px] text-[var(--fg-muted)] transition-colors",
              option === value &&
                "rounded-[var(--radius-md)] bg-[var(--surface)] font-bold text-[var(--fg-strong)] shadow-[inset_0_1px_0_var(--border-strong),inset_0_-1px_0_var(--border-strong)]",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function SimpleInput({
  label,
  name,
  placeholder,
  value,
  onChange,
}: {
  label?: string;
  name?: string;
  placeholder: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const inputId = name ? `community-${name}` : undefined;

  return (
    <label className="block" htmlFor={inputId}>
      {label ? (
        <span className="mb-2 block text-[13px] text-[var(--fg-muted)]">
          {label}
        </span>
      ) : null}
      <input
        id={inputId}
        name={name}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-alt)] px-5 py-4 text-[16px] outline-none placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent)]"
      />
    </label>
  );
}

function InfoBox({
  icon,
  label,
  title,
  body,
}: {
  icon: ReactNode;
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div className="grid grid-cols-[32px_1fr] gap-3 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-alt)] p-4">
      <div className="pt-1 text-[var(--accent)]">{icon}</div>
      <div className="min-w-0">
        <p className="tab-caps text-[12px] font-medium uppercase text-[var(--fg-muted)]">
          {label}
        </p>
        <p className="mt-1 break-words text-[16px] font-bold leading-[1.35] text-[var(--fg-strong)]">
          {title}
        </p>
        <p className="mt-1 break-words text-[12px] leading-6 text-[var(--fg-muted)]">
          {body}
        </p>
      </div>
    </div>
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
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--surface-alt)] text-[var(--fg-muted)]">
        <Coffee size={25} />
      </div>
      <p className="text-[18px] font-bold leading-[1.35] tracking-[-0.01em] text-[var(--fg)]">
        {title}
      </p>
      {description ? (
        <p className="mt-2 text-[14px] text-[var(--fg-muted)]">{description}</p>
      ) : null}
    </div>
  );
}
