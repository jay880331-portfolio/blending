"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  ArrowUp,
  ArrowLeft,
  Camera,
  Download,
  FileText,
  Heart,
  Link as LinkIcon,
  MoreVertical,
  Pencil,
  Play,
  Share2,
  SquarePen,
  X,
} from "lucide-react";
import type {
  PartnerAttachment,
  PartnerCategory,
  PartnerCategoryValue,
  PartnerPromotion,
  PartnerReview,
  PartnerSnapshot,
} from "@/domain/partner/types";
import {
  getYouTubeVideoMetadata,
  selectYouTubePresentation,
  type YouTubeVideoMetadata,
} from "@/domain/partner/youtubeEmbedUrl";
import {
  displayPartnerTitle,
  partnerMultilineTextProps,
} from "@/domain/partner/contentPresentation";
import { formatRelativeTime } from "@/domain/member/dateTime";
import { usePartnerStore } from "@/store/partnerStore";
import { BottomNav } from "@/ui/shared/BottomNav";
import { Button } from "@/ui/shared/Button";
import { Input, Textarea } from "@/ui/shared/Input";
import { PartnerField } from "@/ui/shared/Field";
import { DetailAuthorMeta } from "@/ui/shared/DetailAuthorMeta";
import { ConfirmDialog } from "@/ui/shared/ConfirmDialog";
import { buildProfileHref } from "@/ui/shared/profileNavigation";
import { stopGlobalLoading } from "@/ui/shared/GlobalLoadingBar";
import { HeaderIconActions } from "@/ui/shared/HeaderIconActions";
import { ImageAttachmentSection } from "@/ui/shared/ImageAttachmentSection";
import { useImageCropFlow } from "@/ui/shared/ImageCropEditor";
import {
  isNativeImagePickerAvailable,
  pickNativeImageFiles,
} from "@/ui/shared/nativeImagePicker";
import {
  PARTNER_ATTACHMENT_ACCEPT,
  filterPartnerAttachmentFiles,
} from "@/ui/partner/partnerAttachmentFiles";
import { ImageDetailSlider } from "@/ui/shared/ImageDetailSlider";
import { StoryTabs } from "@/ui/shared/StoryTabs";
import {
  PromotionImageGallery,
  PromotionKindTag,
  PromotionPdfViewer,
  PromotionPeriodChips,
  addDaysIso,
  formatPublishDate,
  isPdfAttachment,
  promotionImageUrls,
  promotionPublishState,
  toDateInputValue,
} from "@/ui/partner/promotionHall";
import { periodDaysFromRange } from "@/domain/partner/promotionPublish";
import { ViewCountMeta } from "@/ui/shared/ViewCountMeta";
import { ReportDialog } from "@/ui/shared/ReportDialog";
import { listenForBlockedUser } from "@/ui/shared/blockedUserEvent";
import { trackContentView } from "@/adapters/http/contentViews";
import { isNativeBridgeAvailable, nativeBridge } from "@/bridge/nativeBridge";
import type { NativeAppInfoResult } from "@blending/bridge";
import {
  createPartnerPromotion,
  createPartnerReview,
  deletePartnerPromotion,
  deletePartnerReview,
  likePartnerPromotion,
  likePartnerReview,
  updatePartnerPromotion,
  updatePartnerReview,
} from "@/adapters/http/partnerMutations";
import { uploadPartnerAttachments } from "@/adapters/http/uploadApi";

type PartnerAppProps = {
  view: string[];
};

type ScreenRouterProps = {
  snapshot: PartnerSnapshot;
  view: string[];
  showToast: (message: string) => void;
};

type AttachedImage = {
  id: string;
  name: string;
  url: string;
  size: number;
  contentType: string;
  file?: File;
};

const PROMOTION_ATTACHMENT_LIMIT = 6;
const PROMOTION_TITLE_MAX = 40;
const PROMOTION_DESCRIPTION_MAX = 500;
const PROMOTION_DRAFT_KEY = "blending.partner.promotion.draft";
const REVIEW_ATTACHMENT_LIMIT = 6;

const categoryOptions: Array<{ value: PartnerCategory; label: string }> = [
  { value: "all", label: "전체" },
  { value: "espresso-machine", label: "에스프레소 머신" },
  { value: "grinder", label: "그라인더" },
  { value: "ice-equipment", label: "제빙기·설비" },
  { value: "brewing-roaster", label: "브루잉·로스터기" },
  { value: "ingredient", label: "부재료" },
  { value: "supplies", label: "용품·소모품" },
];

const writableCategories = categoryOptions.filter(
  (category): category is { value: PartnerCategoryValue; label: string } =>
    category.value !== "all",
);

const partnerPrimaryCtaClass =
  "flex min-w-0 w-full max-w-full items-center justify-center rounded-[var(--radius-lg)] bg-[var(--accent)] px-5 py-5 text-center text-[18px] font-bold text-white shadow-[var(--shadow-card)] transition active:scale-[0.98] sm:px-7";

const clamp: Record<"one" | "two" | "three", CSSProperties> = {
  one: {
    display: "-webkit-box",
    WebkitLineClamp: 1,
    WebkitBoxOrient: "vertical",
  },
  two: {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
  three: {
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
  },
};

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

function FloatingWriteLink({
  href,
  label,
  onClick,
}: {
  href: string;
  label: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
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
        onClick={onClick}
        className="flex h-13 w-13 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--fg-strong)] text-[var(--surface)] shadow-[var(--shadow-modal)] transition active:scale-[0.98]"
      >
        <Icon size={24} strokeWidth={2.1} />
      </Link>
    </div>
  );
}

function ContentActionMenu({
  editHref,
  onDelete,
  deleting,
  label,
  canManage,
  report,
}: {
  editHref: string;
  onDelete: () => Promise<void>;
  deleting: boolean;
  label: string;
  canManage: boolean;
  report?: { targetId: string; authorId?: string };
}) {
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeReport = () => {
    setReportOpen(false);
    queueMicrotask(() => triggerRef.current?.focus());
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${label} 더보기`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] text-[var(--fg-muted)]"
      >
        <MoreVertical size={24} />
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-30 w-36 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] py-2 shadow-[var(--shadow-modal)]">
          {canManage ? (
            <Link
              prefetch={false}
              href={editHref}
              className="block px-4 py-3 text-[15px] font-medium text-[var(--fg)]"
              onClick={() => setOpen(false)}
            >
              수정하기
            </Link>
          ) : null}
          {canManage ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmOpen(true);
              }}
              disabled={deleting}
              className="block w-full px-4 py-3 text-left text-[15px] font-medium text-[var(--accent)] disabled:opacity-40"
            >
              {deleting ? "삭제 중" : "삭제하기"}
            </button>
          ) : null}
          {report ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setReportOpen(true);
              }}
              className="block w-full px-4 py-3 text-left text-[15px] font-medium text-[var(--fg)]"
            >
              신고
            </button>
          ) : null}
        </div>
      ) : null}
      {reportOpen && report ? (
        <ReportDialog
          targetType="content"
          targetId={report.targetId}
          authorId={report.authorId}
          onClose={closeReport}
        />
      ) : null}
      {confirmOpen ? (
        <ConfirmDialog
          onCancel={() => {
            setConfirmOpen(false);
            queueMicrotask(() => triggerRef.current?.focus());
          }}
          onConfirm={onDelete}
        />
      ) : null}
    </div>
  );
}

function createAttachedImage(file: File): AttachedImage {
  return {
    id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
    name: file.name,
    size: file.size,
    contentType: file.type,
    url: URL.createObjectURL(file),
    file,
  };
}

function createAttachedImageFromAttachment(
  attachment: PartnerAttachment,
  index: number,
): AttachedImage {
  return {
    id: `existing-${index}-${attachment.url}`,
    name: attachment.name,
    size: attachment.size,
    contentType: attachment.contentType,
    url: attachment.url,
  };
}

function attachedImageFiles(images: AttachedImage[]) {
  return images.flatMap((image) => (image.file ? [image.file] : []));
}

function existingPartnerAttachments(images: AttachedImage[]) {
  return images.flatMap((image) =>
    image.file
      ? []
      : [
          {
            url: image.url,
            name: image.name,
            size: image.size,
            contentType: image.contentType,
          },
        ],
  );
}

function isImageAttachment(attachment: Pick<PartnerAttachment, "contentType">) {
  return attachment.contentType.startsWith("image/");
}

function imageUrlsFromAttachments(attachments: PartnerAttachment[]) {
  return attachments
    .filter(isImageAttachment)
    .map((attachment) => attachment.url);
}

function validLegacyImageUrls(imageUrls: string[]) {
  return imageUrls.filter((url) => url && url !== "/favicon.ico");
}

function firstPromotionImageUrl(promotion: PartnerPromotion) {
  const attachmentImageUrl = imageUrlsFromAttachments(
    promotion.attachments ?? [],
  )[0];
  return (
    attachmentImageUrl ??
    validLegacyImageUrls([...promotion.imageUrls, promotion.thumbnailUrl])[0]
  );
}

function fileAttachmentsFrom(
  attachments: PartnerAttachment[] | undefined,
  legacyImageUrls: string[],
) {
  const normalizedAttachments =
    attachments ??
    validLegacyImageUrls(legacyImageUrls).map((url) => ({
      url,
      name: "이미지",
      size: 0,
      contentType: "image/jpeg",
    }));

  return {
    imageUrls: imageUrlsFromAttachments(normalizedAttachments),
    files: normalizedAttachments.filter(
      (attachment) => !isImageAttachment(attachment),
    ),
  };
}

function revokeAttachedImages(images: Array<AttachedImage | null | undefined>) {
  images.forEach((image) => {
    if (image?.file) URL.revokeObjectURL(image.url);
  });
}

function handleTagKey(
  event: KeyboardEvent<HTMLInputElement>,
  addTag: () => void,
) {
  if (event.key !== "Enter" && event.key !== " " && event.key !== ",") return;
  event.preventDefault();
  addTag();
}

function continueBulletLine(
  event: KeyboardEvent<HTMLTextAreaElement>,
  updateValue: (value: string) => void,
) {
  if (event.nativeEvent.isComposing || event.key === "Process") return;
  if (
    event.key !== "Enter" ||
    event.shiftKey ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey
  )
    return;

  event.preventDefault();
  const target = event.currentTarget;
  const currentValue = target.value;
  const selectionStart = target.selectionStart;
  const selectionEnd = target.selectionEnd;
  const insertion = currentValue.length === 0 ? "• " : "\n• ";
  const nextValue = `${currentValue.slice(0, selectionStart)}${insertion}${currentValue.slice(selectionEnd)}`;
  const nextCursor = selectionStart + insertion.length;

  updateValue(nextValue);
  requestAnimationFrame(() => target.setSelectionRange(nextCursor, nextCursor));
}

function changeBulletList(
  event: ChangeEvent<HTMLTextAreaElement>,
  updateValue: (value: string) => void,
) {
  const nativeEvent = event.nativeEvent as InputEvent;
  const insertedLineBreak =
    nativeEvent.inputType === "insertLineBreak" ||
    nativeEvent.inputType === "insertParagraph";
  const target = event.currentTarget;
  const currentValue = target.value;

  if (!insertedLineBreak) {
    updateValue(currentValue);
    return;
  }

  const selectionStart = target.selectionStart;
  if (selectionStart === 0 || currentValue[selectionStart - 1] !== "\n") {
    updateValue(currentValue);
    return;
  }

  const insertion = "• ";
  const nextValue = `${currentValue.slice(0, selectionStart)}${insertion}${currentValue.slice(selectionStart)}`;
  const nextCursor = selectionStart + insertion.length;

  updateValue(nextValue);
  requestAnimationFrame(() => target.setSelectionRange(nextCursor, nextCursor));
}

function startBulletList(
  target: HTMLTextAreaElement,
  value: string,
  updateValue: (value: string) => void,
) {
  if (value.length > 0) return;

  updateValue("• ");
  requestAnimationFrame(() => target.setSelectionRange(2, 2));
}

function clearEmptyBulletList(
  value: string,
  updateValue: (value: string) => void,
) {
  const hasOnlyBulletMarkers = value
    .split("\n")
    .every((line) => line.trim().length === 0 || line.trim() === "•");

  if (hasOnlyBulletMarkers) updateValue("");
}

function isFormView(view: string[]) {
  return view[1] === "new";
}

function isListView(view: string[]) {
  return view.length <= 1;
}

function categoryLabel(category: PartnerCategoryValue) {
  return (
    writableCategories.find((item) => item.value === category)?.label ??
    "파트너"
  );
}

function normalizeTagInput(input: string) {
  const tag = input
    .trim()
    .replace(/[,\s]+$/g, "")
    .replace(/^#?/, "#");
  return tag === "#" ? "" : tag;
}

function displayTags(tags: string[]) {
  return tags.map(normalizeTagInput).filter(Boolean);
}

function normalizeExternalUrl(value: string | undefined) {
  const url = value?.trim();
  if (!url) return undefined;
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function useNativeIosYouTubeFallback() {
  const bridgeAvailable = isNativeBridgeAvailable();
  const [nativePlatform, setNativePlatform] = useState<
    NativeAppInfoResult["platform"] | undefined
  >();
  const [nativeBuildNumber, setNativeBuildNumber] = useState<number | null>();

  useEffect(() => {
    if (!bridgeAvailable) return;

    let cancelled = false;
    void nativeBridge
      .getAppInfo()
      .then(({ platform, buildNumber }) => {
        if (cancelled) return;
        setNativePlatform(platform);
        setNativeBuildNumber(buildNumber);
      })
      .catch(() => {
        if (cancelled) return;
        setNativePlatform(undefined);
        setNativeBuildNumber(null);
      });

    return () => {
      cancelled = true;
    };
  }, [bridgeAvailable]);

  return selectYouTubePresentation({
    isNativeBridgeAvailable: bridgeAvailable,
    nativePlatform,
    nativeBuildNumber,
  });
}

function YouTubeEmbed({ video }: { video: YouTubeVideoMetadata | undefined }) {
  const presentation = useNativeIosYouTubeFallback();
  const [openingExternal, setOpeningExternal] = useState(false);

  if (!video) return null;

  const openNativeFallback = async () => {
    if (openingExternal) return;

    setOpeningExternal(true);
    try {
      await nativeBridge.openExternalUrl({ url: video.canonicalWatchUrl });
    } catch {
      window.location.assign(video.canonicalWatchUrl);
    } finally {
      setOpeningExternal(false);
    }
  };

  if (presentation === "native-ios-fallback") {
    return (
      <section
        className="relative mt-8 aspect-video overflow-hidden rounded-[var(--radius-md)] bg-[var(--surface-alt)]"
        aria-label="YouTube 영상"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-70"
          style={{ backgroundImage: `url(${video.thumbnailUrl})` }}
        />
        <div
          className="absolute inset-0 flex items-center justify-center p-5"
          style={{
            backgroundColor: "color-mix(in srgb, var(--fg) 20%, transparent)",
          }}
        >
          <button
            type="button"
            onClick={() => void openNativeFallback()}
            disabled={openingExternal}
            className="flex items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--surface)] px-5 py-3 text-[14px] font-bold text-[var(--fg-strong)] transition active:scale-[0.98] disabled:opacity-40"
          >
            <Play size={18} fill="currentColor" />
            {openingExternal ? "YouTube 여는 중" : "YouTube에서 보기"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <iframe
      src={video.embedUrl}
      title="YouTube 영상"
      loading="lazy"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      className="mt-8 aspect-video w-full rounded-[var(--radius-md)] border-0"
    />
  );
}

function categoryChipClass(selected: boolean) {
  return cn(
    "shrink-0 rounded-[var(--radius-pill)] border px-2.5 py-1.5 text-[12px] font-medium leading-none transition-colors",
    selected
      ? "border-[var(--fg)] bg-[var(--fg)] font-bold text-[var(--surface)]"
      : "border-[var(--border-strong)] bg-[var(--surface-alt)] text-[var(--fg-muted)]",
  );
}

function parseDate(value: string) {
  return new Date(value);
}

function formatShortDate(value: string) {
  const date = parseDate(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function formatCompactCount(value: number) {
  return value >= 1000
    ? `${Number((value / 1000).toFixed(1))}k`
    : String(value);
}

function filteredByCategory<T extends { category: PartnerCategoryValue }>(
  items: T[],
  filter: PartnerCategory,
) {
  return filter === "all"
    ? items
    : items.filter((item) => item.category === filter);
}

function matchesPartnerQuery(values: string[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return values.some((value) => value.toLowerCase().includes(normalizedQuery));
}

function sortNewest<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort(
    (a, b) =>
      parseDate(b.createdAt).getTime() - parseDate(a.createdAt).getTime(),
  );
}

function paginate<T>(items: T[], page: number, perPage: number) {
  return items.slice((page - 1) * perPage, page * perPage);
}

const PARTNER_LIST_PAGE_SIZE = 10;

export function PartnerApp({ view }: PartnerAppProps) {
  const snapshot = usePartnerStore((state) => state.snapshot);
  const status = usePartnerStore((state) => state.status);
  const error = usePartnerStore((state) => state.error);
  const load = usePartnerStore((state) => state.load);
  const removeBlockedUser = usePartnerStore((state) => state.removeBlockedUser);
  const viewKey = view.join("/");
  const [toast, setToast] = useState<string | null>(null);

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

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  };

  if (status === "error") {
    return (
      <PartnerShell view={view}>
        <EmptyState
          title="데이터를 불러오지 못했습니다."
          description={error ?? "잠시 후 다시 시도해주세요."}
        />
        <Toast message={toast} />
      </PartnerShell>
    );
  }

  if (!snapshot) {
    return (
      <PartnerShell view={view}>
        <div className="space-y-4 px-6 py-8">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-[var(--surface-alt)]"
            />
          ))}
        </div>
        <Toast message={toast} />
      </PartnerShell>
    );
  }

  return (
    <PartnerShell view={view} snapshot={snapshot}>
      <ScreenRouter snapshot={snapshot} view={view} showToast={showToast} />
      <Toast message={toast} />
    </PartnerShell>
  );
}

function ScreenRouter({ snapshot, view, showToast }: ScreenRouterProps) {
  const root = view[0] ?? "promotions";
  const second = view[1];

  if (root === "reviews") {
    if (second === "new")
      return <ReviewWriteScreen snapshot={snapshot} showToast={showToast} />;
    if (second)
      return <ReviewDetailScreen snapshot={snapshot} reviewId={second} />;
    return <ReviewListScreen snapshot={snapshot} showToast={showToast} />;
  }

  if (second === "new")
    return <PromotionWriteScreen snapshot={snapshot} showToast={showToast} />;
  if (second)
    return (
      <PromotionDetailScreen
        snapshot={snapshot}
        promotionId={second}
        showToast={showToast}
      />
    );
  return <PromotionListScreen snapshot={snapshot} />;
}

function PartnerShell({
  view,
  snapshot,
  children,
}: {
  view: string[];
  snapshot?: PartnerSnapshot;
  children: ReactNode;
}) {
  const router = useRouter();
  const formView = isFormView(view);
  const listView = isListView(view);
  const showBottomNav = listView && !formView;
  const searchQuery = usePartnerStore((state) => state.searchQuery);
  const setSearchQuery = usePartnerStore((state) => state.setSearchQuery);
  const removePromotion = usePartnerStore((state) => state.removePromotion);
  const removeReview = usePartnerStore((state) => state.removeReview);
  const [deleting, setDeleting] = useState(false);
  const root = view[0] ?? "promotions";
  const detailId = view[1];
  const promotion =
    root !== "reviews" && detailId
      ? snapshot?.promotions.find((item) => item.id === detailId)
      : undefined;
  const review =
    root === "reviews" && detailId
      ? snapshot?.reviews.find((item) => item.id === detailId)
      : undefined;

  useEffect(() => {
    if (listView && searchQuery) setSearchQuery("");
  }, [listView, searchQuery, setSearchQuery]);
  const canManagePromotion = Boolean(snapshot?.isAdmin || promotion?.isOwner);
  const canManageReview = Boolean(snapshot?.isAdmin || review?.isOwner);
  const contentAction =
    promotion && !listView && !formView ? (
      <ContentActionMenu
        editHref={`/partner/promotions/new?edit=${promotion.id}`}
        onDelete={async () => {
          if (deleting) return;
          setDeleting(true);
          try {
            await deletePartnerPromotion(promotion.id);
            removePromotion(promotion.id);
            router.push("/partner/promotions");
          } finally {
            setDeleting(false);
          }
        }}
        deleting={deleting}
        label="홍보글"
        canManage={canManagePromotion}
        report={
          promotion.isOwner
            ? undefined
            : { targetId: promotion.id, authorId: promotion.authorId }
        }
      />
    ) : review && !listView && !formView ? (
      <ContentActionMenu
        editHref={`/partner/reviews/new?edit=${review.id}`}
        onDelete={async () => {
          if (deleting) return;
          setDeleting(true);
          try {
            await deletePartnerReview(review.id);
            removeReview(review.id);
            router.push("/partner/reviews");
          } finally {
            setDeleting(false);
          }
        }}
        deleting={deleting}
        label="리뷰"
        canManage={canManageReview}
        report={
          review.isOwner
            ? undefined
            : { targetId: review.id, authorId: review.authorId }
        }
      />
    ) : null;

  return (
    <div className="min-h-screen bg-[var(--surface-alt)]">
      <div className="relative mx-auto min-h-screen max-w-[var(--app-shell-max-width)] bg-[var(--bg)] shadow-[0_0_0_1px_var(--border)]">
        {!formView ? (
          <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
            <div
              className={cn(
                "grid h-16 items-center px-2",
                listView
                  ? "grid-cols-[84px_1fr_84px]"
                  : contentAction
                    ? "grid-cols-[104px_1fr_104px]"
                    : "grid-cols-[56px_1fr_56px]",
              )}
            >
              {listView ? (
                <div aria-hidden className="h-11 w-11" />
              ) : (
                <button
                  type="button"
                  aria-label="뒤로가기"
                  onClick={() => router.back()}
                  className="flex h-11 w-11 items-center justify-center text-[var(--fg)]"
                >
                  <ArrowLeft size={24} strokeWidth={2} />
                </button>
              )}
              <Link
                prefetch={false}
                href="/community/daily-note"
                className="logo-wordmark text-center text-[25px] font-bold text-[var(--fg-strong)]"
              >
                BLENDING
              </Link>
              <div className="flex items-center justify-end">
                {listView ? (
                  <HeaderIconActions
                    searchHref="/home/search"
                    loadUnreadNotifications
                  />
                ) : (
                  <>
                    <button
                      type="button"
                      aria-label="공유"
                      onClick={() =>
                        window.alert("공유 링크가 복사되었습니다.")
                      }
                      className="flex h-11 w-11 items-center justify-center text-[var(--fg)]"
                    >
                      <Share2 size={22} strokeWidth={2} />
                    </button>
                    {contentAction}
                  </>
                )}
              </div>
            </div>
            {listView ? <PartnerTabs /> : null}
          </header>
        ) : null}
        <main
          className={cn(
            showBottomNav ? "pb-28" : "pb-8",
            !listView && !formView && "pb-28",
          )}
        >
          {children}
        </main>
        {showBottomNav ? <BottomNav active="partner" /> : null}
      </div>
    </div>
  );
}

function PartnerTabs() {
  return <StoryTabs />;
}

function CategoryRail() {
  const activeCategory = usePartnerStore((state) => state.activeCategory);
  const setActiveCategory = usePartnerStore((state) => state.setActiveCategory);

  return (
    <div className="sticky top-[120px] z-30 border-b border-[var(--border)] bg-[var(--surface)]/95 px-6 py-3 backdrop-blur-xl">
      <div className="scrollbar-none flex gap-2 overflow-x-auto">
        {categoryOptions.map((category) => (
          <button
            key={category.value}
            type="button"
            onClick={() => setActiveCategory(category.value)}
            className={categoryChipClass(activeCategory === category.value)}
          >
            {category.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PromotionListScreen({ snapshot }: { snapshot: PartnerSnapshot }) {
  const activeCategory = usePartnerStore((state) => state.activeCategory);
  const searchQuery = usePartnerStore((state) => state.searchQuery);
  const [pageState, setPageState] = useState({
    category: activeCategory,
    query: searchQuery,
    page: 1,
  });
  const page =
    pageState.category === activeCategory && pageState.query === searchQuery
      ? pageState.page
      : 1;
  const filtered = useMemo(
    () =>
      filteredByCategory(
        sortNewest(snapshot.promotions).filter(
          (promotion) => promotionPublishState(promotion).active,
        ),
        activeCategory,
      ).filter((promotion) =>
        matchesPartnerQuery(
          [
            promotion.title,
            promotion.companyName,
            promotion.summary,
            promotion.description,
            promotion.specs.productName,
            ...promotion.tags,
          ],
          searchQuery,
        ),
      ),
    [activeCategory, searchQuery, snapshot.promotions],
  );
  const pageItems = paginate(filtered, page, PARTNER_LIST_PAGE_SIZE);
  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / PARTNER_LIST_PAGE_SIZE),
  );
  const setPage = (nextPage: number) =>
    setPageState({
      category: activeCategory,
      query: searchQuery,
      page: nextPage,
    });

  return (
    <>
      <CategoryRail />
      <section className="px-6 py-6">
        <div className="mb-4 flex items-center justify-between text-[12px] text-[var(--fg-muted)]">
          <span>전체 {filtered.length}건</span>
          <span>최신순</span>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {pageItems.length === 0 ? (
            <EmptyState
              title={
                searchQuery.trim()
                  ? "검색 결과가 없습니다"
                  : "아직 등록된 상품이 없습니다"
              }
              description={
                searchQuery.trim()
                  ? "다른 검색어로 다시 시도해 주세요."
                  : "다른 카테고리를 확인해 주세요."
              }
            />
          ) : (
            pageItems.map((promotion) => (
              <div key={promotion.id} className="py-3">
                <PromotionCard promotion={promotion} />
              </div>
            ))
          )}
        </div>
        {page === totalPages && pageItems.length > 0 ? (
          <p className="mt-8 text-center text-[12px] text-[var(--fg-subtle)]">
            마지막 홍보글이에요
          </p>
        ) : null}
        <Pagination
          page={page}
          totalPages={totalPages}
          onChange={setPage}
          className="mt-9"
        />
      </section>
      {snapshot.isAdmin ? (
        <FloatingWriteLink href="/partner/promotions/new" label="홍보글 작성" />
      ) : null}
    </>
  );
}

function PromotionCard({ promotion }: { promotion: PartnerPromotion }) {
  const likeState = usePartnerStore(
    (state) => state.promotionLikes[promotion.id],
  );
  const liked = likeState?.liked ?? promotion.liked;
  const likes = likeState?.likes ?? promotion.likes;
  const media = fileAttachmentsFrom(
    promotion.attachments,
    promotion.imageUrls.length ? promotion.imageUrls : [promotion.thumbnailUrl],
  );
  const pdf = media.files.find(isPdfAttachment);
  const kind = pdf && media.imageUrls.length === 0 ? "pdf" : "image";
  const thumb = firstPromotionImageUrl(promotion);

  return (
    <Link
      prefetch={false}
      href={`/partner/promotions/${promotion.id}`}
      className="grid grid-cols-[80px_minmax(0,1fr)] gap-3 text-[var(--fg)]"
    >
      <PartnerThumb
        src={kind === "image" ? thumb : undefined}
        size={80}
        fallbackIcon={<FileText size={20} />}
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <PromotionKindTag kind={kind} imageCount={media.imageUrls.length} />
          <span className="truncate text-[12px] text-[var(--fg-muted)]">
            {promotion.companyName} · {categoryLabel(promotion.category)}
          </span>
        </div>
        <h2
          className="mt-1 overflow-hidden text-[16px] font-bold leading-[1.3] text-[var(--fg-strong)]"
          style={clamp.one}
        >
          {displayPartnerTitle(promotion.title, promotion.specs.productName)}
        </h2>
        <p
          className="mt-1 overflow-hidden text-[12px] text-[var(--fg-muted)]"
          style={clamp.one}
        >
          {promotion.summary || promotion.description}
        </p>
        <div className="mt-2 flex items-center justify-end gap-3">
          <ViewCountMeta
            count={promotion.viewCount}
            className="!h-4 !grid-cols-[14px_auto] !gap-0.5 [&>span]:text-[12px] [&>svg]:h-[14px] [&>svg]:w-[14px]"
          />
          <PartnerLikeMeta
            count={likes}
            active={liked}
            className="!grid-cols-[14px_auto] !gap-0.5 [&>span]:text-[12px] [&>svg]:h-[14px] [&>svg]:w-[14px]"
          />
        </div>
      </div>
    </Link>
  );
}

function ReviewListScreen({
  snapshot,
  showToast,
}: {
  snapshot: PartnerSnapshot;
  showToast: (message: string) => void;
}) {
  const activeCategory = usePartnerStore((state) => state.activeCategory);
  const searchQuery = usePartnerStore((state) => state.searchQuery);
  const [pageState, setPageState] = useState({
    category: activeCategory,
    query: searchQuery,
    page: 1,
  });
  const page =
    pageState.category === activeCategory && pageState.query === searchQuery
      ? pageState.page
      : 1;
  const filtered = useMemo(
    () =>
      filteredByCategory(sortNewest(snapshot.reviews), activeCategory).filter(
        (review) =>
          matchesPartnerQuery(
            [
              review.productName,
              review.brand,
              review.modelName,
              review.features,
              review.summary,
              review.body,
              ...review.tags,
            ],
            searchQuery,
          ),
      ),
    [activeCategory, searchQuery, snapshot.reviews],
  );
  const pageItems = paginate(filtered, page, PARTNER_LIST_PAGE_SIZE);
  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / PARTNER_LIST_PAGE_SIZE),
  );
  const isGuest = false;
  const setPage = (nextPage: number) =>
    setPageState({
      category: activeCategory,
      query: searchQuery,
      page: nextPage,
    });

  return (
    <>
      <CategoryRail />
      <section className="px-6 py-6">
        <div className="divide-y divide-[var(--border)]">
          {pageItems.length === 0 ? (
            <EmptyState
              title={
                searchQuery.trim()
                  ? "검색 결과가 없습니다"
                  : "아직 등록된 리뷰가 없습니다"
              }
              description={
                searchQuery.trim()
                  ? "다른 검색어로 다시 시도해 주세요."
                  : "다른 카테고리를 확인해 주세요."
              }
            />
          ) : (
            pageItems.map((review) => (
              <div key={review.id} className="py-2">
                <ReviewCard review={review} />
              </div>
            ))
          )}
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          onChange={setPage}
          className="mt-9"
        />
      </section>
      <FloatingWriteLink
        href="/partner/reviews/new"
        label="리뷰 글쓰기"
        onClick={(event) => {
          if (!isGuest) return;
          event.preventDefault();
          showToast("로그인이 필요한 기능입니다");
        }}
      />
    </>
  );
}

function ReviewCard({ review }: { review: PartnerReview }) {
  const likeState = usePartnerStore((state) => state.reviewLikes[review.id]);
  const liked = likeState?.liked ?? review.liked;
  const likes = likeState?.likes ?? review.likes;

  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)_92px] grid-rows-[minmax(0,1fr)_auto] gap-x-4 gap-y-2">
      <Link
        prefetch={false}
        href={`/partner/reviews/${review.id}`}
        className="row-span-2"
      >
        <PartnerThumb
          src={review.imageUrls[0]}
          fallbackIcon={<Camera size={20} />}
          compact
        />
      </Link>
      <Link
        prefetch={false}
        href={`/partner/reviews/${review.id}`}
        className="col-start-2 row-start-1 min-w-0 text-[var(--fg)]"
      >
        <h2
          className="overflow-hidden text-[16px] font-bold leading-[1.3] text-[var(--fg-strong)]"
          style={clamp.two}
        >
          {displayPartnerTitle(review.summary, review.productName)}
        </h2>
      </Link>
      <Link
        prefetch={false}
        href={`/partner/reviews/${review.id}`}
        className="col-start-2 row-start-2 min-w-0 truncate text-[12px] text-[var(--fg-muted)]"
      >
        {review.reviewer.name} · {categoryLabel(review.category)} ·{" "}
        {formatRelativeTime(review.createdAt)}
      </Link>
      <div className="col-start-3 row-start-2 flex w-[92px] items-center justify-end gap-3 justify-self-end self-center">
        <ViewCountMeta
          count={review.viewCount}
          className="!h-4 !grid-cols-[14px_auto] !gap-0.5 [&>span]:text-[12px] [&>svg]:h-[14px] [&>svg]:w-[14px]"
        />
        <PartnerLikeMeta
          count={likes}
          active={liked}
          className="!grid-cols-[14px_auto] !gap-0.5 [&>span]:text-[12px] [&>svg]:h-[14px] [&>svg]:w-[14px]"
        />
      </div>
    </div>
  );
}

function PartnerThumb({
  src,
  compact = false,
  size,
  fallbackIcon,
}: {
  src?: string;
  compact?: boolean;
  size?: 64 | 80 | 84;
  fallbackIcon?: ReactNode;
}) {
  const edge = size ?? (compact ? 64 : 84);
  const box =
    edge === 64
      ? "h-[64px] w-[64px]"
      : edge === 80
        ? "h-[80px] w-[80px]"
        : "h-[84px] w-[84px]";
  if (!src || src === "/favicon.ico") {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-alt)] text-[var(--fg-muted)]",
          box,
        )}
      >
        {fallbackIcon ?? <Camera size={20} />}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt=""
      width={edge}
      height={edge}
      sizes={`${edge}px`}
      className={cn("rounded-[var(--radius-sm)] object-cover", box)}
      onError={(event) => {
        event.currentTarget.style.display = "none";
      }}
    />
  );
}

function PartnerLikeMeta({
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
      <span className="text-[13px] leading-none tabular-nums text-[var(--fg-muted)]">
        {formatCompactCount(count)}
      </span>
    </span>
  );
}

function PromotionDetailScreen({
  snapshot,
  promotionId,
  showToast,
}: {
  snapshot: PartnerSnapshot;
  promotionId: string;
  showToast: (message: string) => void;
}) {
  const promotion = snapshot.promotions.find((item) => item.id === promotionId);
  const likeState = usePartnerStore(
    (state) => state.promotionLikes[promotionId],
  );
  const togglePromotionLike = usePartnerStore(
    (state) => state.togglePromotionLike,
  );
  const setContentViewCount = usePartnerStore(
    (state) => state.setContentViewCount,
  );
  const trackedPromotionId = promotion?.id;

  useEffect(() => {
    if (!trackedPromotionId) return;
    void trackContentView("partner_promotion", trackedPromotionId)
      .then(({ viewCount }) =>
        setContentViewCount("partner_promotion", trackedPromotionId, viewCount),
      )
      .catch(() => undefined);
  }, [trackedPromotionId, setContentViewCount]);

  if (!promotion)
    return (
      <EmptyState
        title="홍보글을 찾을 수 없습니다."
        description="삭제되었거나 잘못된 주소예요."
      />
    );

  const externalUrl = normalizeExternalUrl(promotion.externalUrl);
  const youtubeVideo = getYouTubeVideoMetadata(externalUrl);
  const embedUrl = youtubeVideo?.embedUrl;
  const liked = likeState?.liked ?? promotion.liked;
  const likes = likeState?.likes ?? promotion.likes;
  const openExternal = () => {
    if (!externalUrl) {
      showToast("현재 구매 페이지로 이동할 수 없습니다.");
      return;
    }
    window.location.assign(externalUrl);
  };
  const promotionAttachments = fileAttachmentsFrom(
    promotion.attachments,
    promotion.imageUrls.length ? promotion.imageUrls : [promotion.thumbnailUrl],
  );
  const pdf = promotionAttachments.files.find(isPdfAttachment);
  const galleryImages = promotionImageUrls(
    promotion,
    promotionAttachments.imageUrls,
  );
  const publish = promotionPublishState(promotion);
  const kind = pdf && galleryImages.length === 0 ? "pdf" : "image";
  return (
    <article className="pb-24">
      <div className="px-6 pt-5">
        <div className="flex items-center gap-2">
          <PromotionKindTag kind={kind} imageCount={galleryImages.length} />
          <span className="rounded-[var(--radius-sm)] bg-[var(--surface-alt)] px-1.5 py-0.5 text-[11px] font-bold leading-none text-[var(--fg-muted)]">
            {categoryLabel(promotion.category)}
          </span>
        </div>
        <h1 className="mt-3 text-[20px] font-bold leading-[1.35] tracking-[-0.01em] text-[var(--fg-strong)]">
          {displayPartnerTitle(promotion.title, promotion.specs.productName)}
        </h1>
        <p className="mt-2 text-[12px] text-[var(--fg-muted)]">
          {formatPublishDate(publish.from)} |{" "}
          <span
            className={
              publish.active ? "font-bold text-[var(--success)]" : undefined
            }
          >
            {publish.statusLabel}
          </span>
          {publish.active && publish.remainingDays != null
            ? ` · ${publish.remainingDays}일 남음`
            : null}
        </p>
        <SpecTable
          rows={[
            ["업체명", promotion.specs.companyName],
            ["제품명", promotion.specs.productName],
            ["카테고리", categoryLabel(promotion.category)],
          ]}
          className="mt-6"
        />
        <section className="mt-7 space-y-3">
          <h2 className="text-[16px] font-bold text-[var(--fg-strong)]">
            설명 자료
          </h2>
          <p
            {...partnerMultilineTextProps(promotion.description)}
            className="whitespace-pre-line text-[12px] leading-6 text-[var(--fg)]"
          />
        </section>
        <div className="mt-7">
          {kind === "pdf" && pdf ? (
            <PromotionPdfViewer attachment={pdf} />
          ) : (
            <PromotionImageGallery images={galleryImages} />
          )}
        </div>
        <YouTubeEmbed video={youtubeVideo} />
        <div className="mt-7 flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--border)] px-4 py-3">
          <DetailAuthorMeta
            name={promotion.authorName}
            date="작성자"
            badge="관리자"
            avatarUrl={promotion.authorAvatarUrl}
            profileHref={
              promotion.authorId
                ? buildProfileHref(
                    promotion.authorId,
                    `/partner/promotions/${promotion.id}`,
                  )
                : undefined
            }
          />
          <div className="flex items-center gap-3">
            <ViewCountMeta count={promotion.viewCount} />
            <button
              type="button"
              aria-label={liked ? "홍보글 좋아요 취소" : "홍보글 좋아요"}
              onClick={async () => {
                const nextLiked = !liked;
                togglePromotionLike(
                  promotion.id,
                  promotion.likes,
                  promotion.liked,
                );
                try {
                  await likePartnerPromotion(promotion.id, nextLiked);
                } catch {
                  togglePromotionLike(
                    promotion.id,
                    promotion.likes,
                    promotion.liked,
                  );
                  window.alert("관심 글 상태를 변경하지 못했습니다.");
                }
              }}
            >
              <PartnerLikeMeta count={likes} active={liked} />
            </button>
          </div>
        </div>
        {kind === "image" ? (
          <AttachmentDownloadList
            attachments={promotionAttachments.files}
            className="mt-8"
          />
        ) : null}
        <TagList tags={promotion.tags} className="mt-8" />
      </div>
      {!embedUrl ? (
        <StickyAction>
          <button
            type="button"
            onClick={openExternal}
            className={partnerPrimaryCtaClass}
          >
            제품 문의하기
          </button>
        </StickyAction>
      ) : null}
    </article>
  );
}

function ReviewDetailScreen({
  snapshot,
  reviewId,
}: {
  snapshot: PartnerSnapshot;
  reviewId: string;
}) {
  const review = snapshot.reviews.find((item) => item.id === reviewId);
  const likeState = usePartnerStore((state) => state.reviewLikes[reviewId]);
  const toggleReviewLike = usePartnerStore((state) => state.toggleReviewLike);
  const setContentViewCount = usePartnerStore(
    (state) => state.setContentViewCount,
  );
  const trackedReviewId = review?.id;

  useEffect(() => {
    if (!trackedReviewId) return;
    void trackContentView("partner_review", trackedReviewId)
      .then(({ viewCount }) =>
        setContentViewCount("partner_review", trackedReviewId, viewCount),
      )
      .catch(() => undefined);
  }, [trackedReviewId, setContentViewCount]);

  if (!review)
    return (
      <EmptyState
        title="리뷰를 찾을 수 없습니다."
        description="삭제되었거나 잘못된 주소예요."
      />
    );

  const relatedPromotion = snapshot.promotions.find(
    (promotion) => promotion.id === review.promotionId,
  );
  const reviewAttachments = fileAttachmentsFrom(
    review.attachments,
    review.imageUrls,
  );
  const relatedUrl = normalizeExternalUrl(review.relatedUrl);
  const youtubeVideo = getYouTubeVideoMetadata(relatedUrl);
  const embedUrl = youtubeVideo?.embedUrl;
  const liked = likeState?.liked ?? review.liked;
  const likes = likeState?.likes ?? review.likes;
  return (
    <article className="pb-[calc(var(--app-bottom-nav-height)+72px)]">
      <div className="px-6 py-6">
        <ImageDetailSlider images={reviewAttachments.imageUrls} />
        <h1 className="mt-8 text-[16px] font-bold leading-[1.35] tracking-[-0.01em] text-[var(--fg-strong)]">
          {displayPartnerTitle(review.summary, review.productName)}
        </h1>
        <DetailAuthorMeta
          name={review.reviewer.name}
          date={formatShortDate(review.createdAt)}
          avatarUrl={review.reviewer.avatarUrl}
          className="mt-5"
          profileHref={
            review.authorId
              ? buildProfileHref(
                  review.authorId,
                  `/partner/reviews/${review.id}`,
                )
              : undefined
          }
        />
        <SpecTable
          rows={[
            ["브랜드", review.brand],
            ["모델명", review.modelName],
            ["주요특징", review.features],
          ]}
          className="mt-8"
        />
        <div className="mt-8 space-y-5 text-[12px] leading-6 text-[var(--fg)] [overflow-wrap:anywhere]">
          <p {...partnerMultilineTextProps(review.body)} />
        </div>
        <YouTubeEmbed video={youtubeVideo} />
        <div className="mt-7 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            aria-label={liked ? "리뷰 좋아요 취소" : "리뷰 좋아요"}
            onClick={async () => {
              const nextLiked = !liked;
              toggleReviewLike(review.id, review.likes, review.liked);
              try {
                await likePartnerReview(review.id, nextLiked);
              } catch {
                toggleReviewLike(review.id, review.likes, review.liked);
                window.alert("관심 글 상태를 변경하지 못했습니다.");
              }
            }}
            className="flex items-center"
          >
            <PartnerLikeMeta count={likes} active={liked} />
          </button>
        </div>
        <section className="mt-8">
          <h2 className="border-b border-[var(--border)] pb-3 text-[18px] font-bold leading-[1.35] tracking-[-0.01em]">
            장점
          </h2>
          <div className="mt-4 rounded-[var(--radius-lg)] bg-[var(--surface-alt)] p-5 [overflow-wrap:anywhere]">
            <ul className="list-disc space-y-2 pl-5 text-[14px] leading-[1.6] text-[var(--fg)]">
              {review.majorPros.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
        <section className="mt-8">
          <h2 className="border-b border-[var(--border)] pb-3 text-[18px] font-bold leading-[1.35] tracking-[0.16em]">
            나만의 활용 팁
          </h2>
          <div className="mt-4 rounded-[var(--radius-lg)] bg-[var(--surface-alt)] p-5 text-[14px] leading-[1.7] text-[var(--fg)] [overflow-wrap:anywhere]">
            <p {...partnerMultilineTextProps(review.baristaTip)} />
          </div>
        </section>
        <AttachmentDownloadList
          attachments={reviewAttachments.files}
          className="mt-8"
        />
        <TagList tags={review.tags} className="mt-8" />
      </div>
      <StickyAction>
        <Link
          prefetch={false}
          href={
            (!embedUrl ? relatedUrl : undefined) ??
            (relatedPromotion
              ? `/partner/promotions/${relatedPromotion.id}`
              : "/partner/promotions")
          }
          className={partnerPrimaryCtaClass}
        >
          이 장비 자세히 보기
        </Link>
      </StickyAction>
    </article>
  );
}

function PromotionWriteScreen({
  snapshot,
  showToast,
}: {
  snapshot: PartnerSnapshot;
  showToast: (message: string) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const editPromotion = editId
    ? snapshot.promotions.find((promotion) => promotion.id === editId)
    : undefined;
  const existingPromotionAttachments =
    editPromotion?.attachments ??
    (editPromotion
      ? validLegacyImageUrls(
          editPromotion.imageUrls.length
            ? editPromotion.imageUrls
            : [editPromotion.thumbnailUrl],
        ).map((url) => ({
          url,
          name: "이미지",
          size: 0,
          contentType: "image/jpeg",
        }))
      : []);
  const [companyName, setCompanyName] = useState(
    editPromotion?.companyName ?? "",
  );
  const [productName, setProductName] = useState(
    editPromotion?.specs.productName ?? "",
  );
  const [category, setCategory] = useState<PartnerCategoryValue | null>(
    editPromotion?.category ?? "espresso-machine",
  );
  const [promotionTitle, setPromotionTitle] = useState(
    editPromotion?.title ?? "",
  );
  const [description, setDescription] = useState(
    editPromotion?.description ?? "",
  );
  const [officialUrl, setOfficialUrl] = useState(
    editPromotion?.externalUrl ?? "",
  );
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState(
    editPromotion?.tags.length ? editPromotion.tags : [],
  );
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>(() =>
    existingPromotionAttachments.map(createAttachedImageFromAttachment),
  );
  const initialFrom = editPromotion?.publishedFrom ?? new Date().toISOString();
  const initialTo = editPromotion?.publishedTo ?? addDaysIso(initialFrom, 30);
  const [periodDays, setPeriodDays] = useState<7 | 14 | 30 | "custom">(() =>
    editPromotion?.publishedFrom && editPromotion?.publishedTo
      ? periodDaysFromRange(
          editPromotion.publishedFrom,
          editPromotion.publishedTo,
        )
      : 30,
  );
  const [customFrom, setCustomFrom] = useState(toDateInputValue(initialFrom));
  const [customTo, setCustomTo] = useState(toDateInputValue(initialTo));
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const attachedImagesRef = useRef<AttachedImage[]>([]);
  const { startImageCrop, imageCropEditor } = useImageCropFlow((files) => {
    setAttachedImages((current) => [
      ...current,
      ...files.map(createAttachedImage),
    ]);
    setErrors((current) => ({ ...current, mainPhoto: false }));
  });
  const dirty =
    productName ||
    promotionTitle ||
    description ||
    officialUrl ||
    attachedImages.length > 0 ||
    category;

  useEffect(() => {
    attachedImagesRef.current = attachedImages;
  }, [attachedImages]);

  useEffect(() => () => revokeAttachedImages(attachedImagesRef.current), []);

  /* eslint-disable react-hooks/set-state-in-effect -- sessionStorage draft after mount */
  useEffect(() => {
    if (editPromotion) return;
    try {
      const raw = sessionStorage.getItem(PROMOTION_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        companyName?: string;
        productName?: string;
        category?: PartnerCategoryValue;
        promotionTitle?: string;
        description?: string;
        officialUrl?: string;
        tags?: string[];
        periodDays?: 7 | 14 | 30 | "custom";
        customFrom?: string;
        customTo?: string;
      };
      if (draft.companyName) setCompanyName(draft.companyName);
      if (draft.productName) setProductName(draft.productName);
      if (draft.category) setCategory(draft.category);
      if (draft.promotionTitle) setPromotionTitle(draft.promotionTitle);
      if (draft.description) setDescription(draft.description);
      if (draft.officialUrl) setOfficialUrl(draft.officialUrl);
      if (draft.tags) setTags(draft.tags);
      if (draft.periodDays) setPeriodDays(draft.periodDays);
      if (draft.customFrom) setCustomFrom(draft.customFrom);
      if (draft.customTo) setCustomTo(draft.customTo);
    } catch {
      sessionStorage.removeItem(PROMOTION_DRAFT_KEY);
    }
  }, [editPromotion]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const cancel = () => {
    if (dirty) {
      setConfirmOpen(true);
      return;
    }
    router.back();
  };

  const missingRequired = [
    attachedImages.length === 0,
    companyName.trim().length === 0,
    productName.trim().length === 0,
    !category,
    promotionTitle.trim().length === 0,
  ].filter(Boolean).length;
  const canSubmit = missingRequired === 0;
  const publishedFrom = new Date(`${customFrom}T00:00:00`).toISOString();
  const publishedTo = new Date(`${customTo}T23:59:59`).toISOString();
  const periodLabel = `${formatPublishDate(publishedFrom)} ~ ${formatPublishDate(publishedTo).slice(5)} 게시`;
  const periodDaysCount = Math.max(
    1,
    Math.round(
      (Date.parse(customTo) - Date.parse(customFrom)) / (24 * 60 * 60 * 1000),
    ),
  );
  const endDate = new Date(publishedTo);

  const saveDraft = () => {
    sessionStorage.setItem(
      PROMOTION_DRAFT_KEY,
      JSON.stringify({
        companyName,
        productName,
        category,
        promotionTitle,
        description,
        officialUrl,
        tags,
        periodDays,
        customFrom,
        customTo,
      }),
    );
    showToast("임시저장했습니다");
  };

  const selectPeriod = (days: 7 | 14 | 30 | "custom") => {
    setPeriodDays(days);
    if (days === "custom") return;
    const from = new Date();
    setCustomFrom(toDateInputValue(from));
    setCustomTo(toDateInputValue(addDaysIso(from.toISOString(), days)));
  };

  const submit = async () => {
    const nextErrors = {
      mainPhoto: !attachedImages.length,
      companyName: companyName.trim().length === 0,
      productName: productName.trim().length === 0,
      category: !category,
      promotionTitle: promotionTitle.trim().length === 0,
    };
    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      showToast("필수 항목을 입력해 주세요");
      return;
    }

    if (!category || submitting) return;

    setSubmitting(true);
    try {
      const uploadedAttachments =
        attachedImages.length > 0
          ? await uploadPartnerAttachments(
              attachedImageFiles(attachedImages),
              "partner/promotions",
            )
          : [];
      const attachments = [
        ...existingPartnerAttachments(attachedImages),
        ...uploadedAttachments,
      ];
      const imageUrls = imageUrlsFromAttachments(attachments);
      const input = {
        title: promotionTitle.trim() || productName.trim(),
        category,
        companyName: companyName.trim(),
        productName: productName.trim(),
        description: description.trim(),
        thumbnailUrl: imageUrls[0],
        imageUrls,
        attachments,
        tags,
        externalUrl: normalizeExternalUrl(officialUrl),
        publishedFrom,
        publishedTo,
      };
      sessionStorage.removeItem(PROMOTION_DRAFT_KEY);
      if (editPromotion) {
        await updatePartnerPromotion(editPromotion.id, input);
        window.location.replace("/partner/promotions");
        return;
      }
      const promotion = await createPartnerPromotion(input);
      window.location.assign(`/partner/promotions/${promotion.id}`);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : `홍보글 ${editPromotion ? "수정" : "등록"}에 실패했습니다.`,
      );
      setSubmitting(false);
    }
  };

  const attachFiles = (files: File[]) => {
    if (files.length === 0) return;

    const remaining = PROMOTION_ATTACHMENT_LIMIT - attachedImages.length;
    if (remaining <= 0) {
      showToast(
        `파일은 최대 ${PROMOTION_ATTACHMENT_LIMIT}개까지 첨부할 수 있습니다.`,
      );
      return;
    }

    if (files.length > remaining) {
      showToast(`파일은 ${remaining}개만 더 첨부할 수 있습니다.`);
    }

    const validFiles = filterPartnerAttachmentFiles(
      files.slice(0, remaining),
      showToast,
    );
    startImageCrop(validFiles);
  };

  const attachImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    attachFiles(files);
  };

  const openNativeImagePicker = isNativeImagePickerAvailable()
    ? async () => {
        try {
          const remaining = PROMOTION_ATTACHMENT_LIMIT - attachedImages.length;
          const files = await pickNativeImageFiles(remaining);
          attachFiles(files ?? []);
        } catch {
          showToast("이미지 선택에 실패했습니다. 다시 시도해주세요.");
        }
      }
    : undefined;

  const addTag = () => {
    const value = normalizeTagInput(tagInput);
    if (!value) return;
    if (tags.length >= 5) {
      showToast("검색 태그는 최대 5개까지 등록할 수 있습니다.");
      return;
    }
    if (!tags.includes(value)) setTags((items) => [...items, value]);
    setTagInput("");
  };

  return (
    <>
      {imageCropEditor}
      <div className="min-h-screen pb-8">
        <WriteHeader
          title="홍보글 작성"
          onCancel={cancel}
          action={
            <button
              type="button"
              onClick={saveDraft}
              className="px-2 text-[12px] font-bold text-[var(--fg-muted)]"
            >
              임시저장
            </button>
          }
        />
        <section className="space-y-9 px-6 py-7">
          <ImageAttachmentSection
            title="제품 이미지 · 첨부 파일"
            images={attachedImages}
            limit={PROMOTION_ATTACHMENT_LIMIT}
            accept={PARTNER_ATTACHMENT_ACCEPT}
            inputName="promotionImages"
            ariaPrefix="홍보"
            addLabel="추가"
            countUnit="개"
            countLabel={`${attachedImages.length} / ${PROMOTION_ATTACHMENT_LIMIT}`}
            onAttachImages={attachImages}
            onOpenNativePicker={openNativeImagePicker}
            onRemoveImage={(image) => {
              revokeAttachedImages([image]);
              setAttachedImages((current) =>
                current.filter((item) => item.id !== image.id),
              );
            }}
          />
          <p className="-mt-6 text-[12px] text-[var(--fg-subtle)]">
            이미지는 캐러셀, PDF는 페이지 뷰어로 보여요
          </p>
          {errors.mainPhoto ? (
            <p className="-mt-6 text-[13px] font-bold leading-5 text-[var(--accent)]">
              제품 이미지 또는 파일을 1개 이상 첨부해 주세요.
            </p>
          ) : null}

          <FormSection title="기본 정보">
            <PartnerField label="업체명 *">
              <Input
                variant="partner"
                id="promotion-company-name"
                name="companyName"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className={cn(errors.companyName && "partner-field-error")}
              />
            </PartnerField>
            <PartnerField label="제품명 *">
              <Input
                variant="partner"
                value={productName}
                id="promotion-product-name"
                name="productName"
                onChange={(event) => setProductName(event.target.value)}
                placeholder="제품명을 입력해주세요"
                className={cn(errors.productName && "partner-field-error")}
              />
            </PartnerField>
            <div>
              <p className="mb-3 text-[12px] font-bold text-[var(--fg)]">
                카테고리 *
              </p>
              <CategoryChips
                selected={category}
                onSelect={setCategory}
                error={errors.category}
              />
            </div>
          </FormSection>

          <FormSection title="홍보 내용">
            <PartnerField
              label="제목 *"
              hint={`${promotionTitle.length} / ${PROMOTION_TITLE_MAX}`}
            >
              <Input
                variant="partner"
                id="promotion-title"
                name="promotionTitle"
                value={promotionTitle}
                maxLength={PROMOTION_TITLE_MAX}
                onChange={(event) => setPromotionTitle(event.target.value)}
                className={cn(errors.promotionTitle && "partner-field-error")}
                placeholder="제목을 입력하세요"
              />
            </PartnerField>
            <PartnerField
              label="설명 자료"
              hint={`${description.length} / ${PROMOTION_DESCRIPTION_MAX}`}
            >
              <Textarea
                variant="partner"
                id="promotion-description"
                name="description"
                value={description}
                maxLength={PROMOTION_DESCRIPTION_MAX}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-[160px] resize-none text-[12px] leading-6"
                placeholder="예: 듀얼 보일러의 온도 안정성과 매장 활용 사례를 소개해 보세요."
              />
            </PartnerField>
          </FormSection>

          <FormSection title="게시 기간 *">
            <div className="grid grid-cols-2 gap-3">
              <PartnerField label="시작일">
                <Input
                  variant="partner"
                  type="date"
                  value={customFrom}
                  onChange={(event) => {
                    setPeriodDays("custom");
                    setCustomFrom(event.target.value);
                  }}
                />
              </PartnerField>
              <PartnerField label="종료일">
                <Input
                  variant="partner"
                  type="date"
                  value={customTo}
                  onChange={(event) => {
                    setPeriodDays("custom");
                    setCustomTo(event.target.value);
                  }}
                />
              </PartnerField>
            </div>
            <PromotionPeriodChips
              selectedDays={periodDays}
              onSelect={selectPeriod}
            />
            <div className="rounded-[var(--radius-lg)] border-l-4 border-[var(--fg)] bg-[var(--surface-alt)] px-4 py-3">
              <p className="text-[13px] font-bold text-[var(--fg-strong)]">
                {periodDaysCount}일간 게시 · {endDate.getMonth() + 1}월{" "}
                {endDate.getDate()}일 자동 종료
              </p>
              <p className="mt-1 text-[12px] leading-5 text-[var(--fg-muted)]">
                종료일이 지나면 목록에서 자동으로 숨겨져요. 내가 쓴 홍보글에서
                다시 게시할 수 있어요.
              </p>
            </div>
          </FormSection>

          <FormSection title="추가 정보 선택">
            <PartnerField label="공식 링크 · 상세페이지">
              <div className="relative">
                <LinkIcon
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]"
                  size={16}
                  aria-hidden
                />
                <Input
                  variant="partner"
                  id="promotion-official-url"
                  name="officialUrl"
                  value={officialUrl}
                  onChange={(event) => setOfficialUrl(event.target.value)}
                  className="partner-input-with-icon text-[12px]"
                  placeholder="https://"
                />
              </div>
            </PartnerField>
            <PartnerField label="검색 태그">
              <Input
                variant="partner"
                id="promotion-search-tag"
                name="searchTag"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => handleTagKey(event, addTag)}
                className="text-[12px]"
                placeholder="#태그를 입력하세요 (엔터로 추가)"
              />
            </PartnerField>
            <EditableTagList
              tags={tags}
              onRemove={(tag) =>
                setTags((items) => items.filter((item) => item !== tag))
              }
            />
          </FormSection>
        </section>
        <div className="sticky bottom-0 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4">
          <p className="mb-3 text-[12px] text-[var(--fg-muted)]">
            {missingRequired > 0
              ? `필수 항목 ${missingRequired}개가 남았어요 · ${periodLabel}`
              : periodLabel}
          </p>
          <Button
            variant="base"
            type="button"
            disabled={!canSubmit || submitting}
            onClick={submit}
            className="w-full bg-[var(--fg-strong)] text-[var(--surface)]"
          >
            {submitting
              ? "저장 중..."
              : editPromotion
                ? "홍보글 수정하기"
                : "홍보글 등록하기"}
          </Button>
        </div>
        {confirmOpen ? (
          <ConfirmModal
            message="작성 중인 내용이 사라집니다. 나가시겠습니까?"
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => router.back()}
          />
        ) : null}
      </div>
    </>
  );
}

function ReviewWriteScreen({
  snapshot,
  showToast,
}: {
  snapshot: PartnerSnapshot;
  showToast: (message: string) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const editReview = editId
    ? snapshot.reviews.find((review) => review.id === editId)
    : undefined;
  const existingReviewAttachments =
    editReview?.attachments ??
    (editReview?.imageUrls ?? []).map((url) => ({
      url,
      name: "이미지",
      size: 0,
      contentType: "image/jpeg",
    }));
  const [category, setCategory] = useState<PartnerCategoryValue | null>(
    editReview?.category ?? "espresso-machine",
  );
  const [title, setTitle] = useState(editReview?.summary ?? "");
  const [body, setBody] = useState(editReview?.body ?? "");
  const [brand, setBrand] = useState(editReview?.brand ?? "");
  const [modelName, setModelName] = useState(editReview?.modelName ?? "");
  const [features, setFeatures] = useState(editReview?.features ?? "");
  const [pros, setPros] = useState(
    editReview?.majorPros.map((item) => `• ${item}`).join("\n") ?? "",
  );
  const [tip, setTip] = useState(editReview?.baristaTip ?? "");
  const [url, setUrl] = useState(editReview?.relatedUrl ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState(
    editReview?.tags.length ? editReview.tags : [],
  );
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>(() =>
    existingReviewAttachments.map(createAttachedImageFromAttachment),
  );
  const [infoErrors, setInfoErrors] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const attachedImagesRef = useRef<AttachedImage[]>([]);
  const { startImageCrop, imageCropEditor } = useImageCropFlow((files) => {
    setAttachedImages((current) => [
      ...current,
      ...files.map(createAttachedImage),
    ]);
  });

  useEffect(() => {
    attachedImagesRef.current = attachedImages;
  }, [attachedImages]);

  useEffect(() => () => revokeAttachedImages(attachedImagesRef.current), []);

  const canSubmit =
    brand.trim().length > 0 &&
    modelName.trim().length > 0 &&
    title.trim().length > 0 &&
    body.trim().length >= 100 &&
    Boolean(category);

  const submit = async () => {
    const nextInfoErrors = {
      brand: brand.trim().length === 0,
      modelName: modelName.trim().length === 0,
    };
    setInfoErrors(nextInfoErrors);
    if (Object.values(nextInfoErrors).some(Boolean)) {
      showToast("필수 항목을 입력해 주세요");
      return;
    }

    if (!title.trim()) {
      showToast("리뷰 제목을 입력해 주세요");
      return;
    }
    if (body.trim().length < 100) {
      showToast("리뷰 내용을 100자 이상 성의 있게 작성해 주세요");
      return;
    }
    if (!category || submitting) return;

    setSubmitting(true);
    try {
      const uploadedAttachments =
        attachedImages.length > 0
          ? await uploadPartnerAttachments(
              attachedImageFiles(attachedImages),
              "partner/reviews",
            )
          : [];
      const attachments = [
        ...existingPartnerAttachments(attachedImages),
        ...uploadedAttachments,
      ];
      const imageUrls = imageUrlsFromAttachments(attachments);
      const input = {
        productName: modelName.trim(),
        category,
        brand: brand.trim(),
        modelName: modelName.trim(),
        features: features.trim(),
        summary: title.trim(),
        body: body.trim(),
        imageUrls,
        attachments,
        tags,
        majorPros: pros
          .split("\n")
          .map((item) => item.replace(/^•\s*/, "").trim())
          .filter(Boolean),
        baristaTip: tip.trim(),
        relatedUrl: normalizeExternalUrl(url),
      };
      if (editReview) {
        await updatePartnerReview(editReview.id, input);
        window.location.replace("/partner/reviews");
        return;
      }
      const review = await createPartnerReview(input);
      window.location.assign(`/partner/reviews/${review.id}`);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : `리뷰 ${editReview ? "수정" : "등록"}에 실패했습니다.`,
      );
      setSubmitting(false);
    }
  };

  const addTag = () => {
    const value = normalizeTagInput(tagInput);
    if (!value) return;
    if (tags.length >= 5) {
      showToast("태그는 최대 5개까지 등록할 수 있습니다.");
      return;
    }
    if (!tags.includes(value)) setTags((items) => [...items, value]);
    setTagInput("");
  };

  const attachFiles = (files: File[]) => {
    if (files.length === 0) return;

    const remaining = REVIEW_ATTACHMENT_LIMIT - attachedImages.length;
    if (remaining <= 0) {
      showToast(
        `파일은 최대 ${REVIEW_ATTACHMENT_LIMIT}개까지 첨부할 수 있습니다.`,
      );
      return;
    }

    if (files.length > remaining) {
      showToast(`파일은 ${remaining}개만 더 첨부할 수 있습니다.`);
    }

    const validFiles = filterPartnerAttachmentFiles(
      files.slice(0, remaining),
      showToast,
    );
    startImageCrop(validFiles);
  };

  const attachImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    attachFiles(files);
  };

  const openNativeImagePicker = isNativeImagePickerAvailable()
    ? async () => {
        try {
          const remaining = REVIEW_ATTACHMENT_LIMIT - attachedImages.length;
          const files = await pickNativeImageFiles(remaining);
          attachFiles(files ?? []);
        } catch {
          showToast("이미지 선택에 실패했습니다. 다시 시도해주세요.");
        }
      }
    : undefined;

  return (
    <>
      {imageCropEditor}
      <div className="min-h-screen pb-8">
        <WriteHeader
          title="BLENDING"
          onCancel={() => router.back()}
          logoTitle
        />
        <section className="space-y-8 px-6 py-7">
          <PartnerReviewImageUploadSection
            attachedImages={attachedImages}
            onAttachImages={attachImages}
            onOpenNativePicker={openNativeImagePicker}
            onRemoveImage={(image) => {
              revokeAttachedImages([image]);
              setAttachedImages((current) =>
                current.filter((item) => item.id !== image.id),
              );
            }}
          />

          <FormSection title="기본 정보">
            <PartnerField label="업체명 *">
              <Input
                variant="partner"
                id="review-brand"
                name="brand"
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
                className={cn(infoErrors.brand && "partner-field-error")}
                placeholder="업체명을 입력해주세요"
              />
            </PartnerField>
            <PartnerField label="제품명 *">
              <Input
                variant="partner"
                id="review-model-name"
                name="modelName"
                value={modelName}
                onChange={(event) => setModelName(event.target.value)}
                className={cn(infoErrors.modelName && "partner-field-error")}
                placeholder="제품명을 입력해주세요"
              />
            </PartnerField>
            <PartnerField label="주요 특징">
              <Input
                variant="partner"
                id="review-features"
                name="features"
                value={features}
                onChange={(event) => setFeatures(event.target.value)}
                placeholder="예: 듀얼 보일러, 로터리 펌프"
              />
            </PartnerField>
            <div>
              <p className="mb-3 text-[12px] font-bold text-[var(--fg)]">
                카테고리 선택 *
              </p>
              <CategoryChips selected={category} onSelect={setCategory} />
            </div>
          </FormSection>

          <div className="space-y-5">
            <input
              id="review-title"
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full border-0 border-b border-[var(--border-strong)] bg-transparent pb-3 text-[16px] font-bold leading-[1.35] tracking-[-0.01em] text-[var(--fg)] outline-none placeholder:text-[var(--fg-faint)]"
              placeholder="제목을 입력하세요"
            />
            <textarea
              id="review-body"
              name="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="min-h-[240px] w-full resize-none border-0 bg-transparent text-[12px] leading-6 text-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)]"
              placeholder="예: 3개월 사용해보니 연속 추출은 안정적이고 예열은 긴 편이에요."
            />
          </div>

          <textarea
            id="review-major-pros"
            name="majorPros"
            value={pros}
            onChange={(event) => changeBulletList(event, setPros)}
            onFocus={(event) =>
              startBulletList(event.currentTarget, pros, setPros)
            }
            onBlur={() => clearEmptyBulletList(pros, setPros)}
            onKeyDown={(event) => continueBulletLine(event, setPros)}
            className="partner-textarea min-h-[140px] text-[12px] leading-6"
            placeholder={"• 이 제품의 가장 큰 장점을 나열해 주세요.\n• "}
          />
          <textarea
            id="review-barista-tip"
            name="baristaTip"
            value={tip}
            onChange={(event) => setTip(event.target.value)}
            className="partner-textarea min-h-[150px] text-[12px] leading-6"
            placeholder="본인만의 사용법이나 관리 노하우 등을 공유해 주세요."
          />

          <FormSection title="추가 정보">
            <div className="relative">
              <LinkIcon
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]"
                size={16}
                aria-hidden
              />
              <Input
                variant="partner"
                id="review-related-url"
                name="relatedUrl"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                className="partner-input-with-icon text-[12px]"
                placeholder="공식 링크 / 상세페이지"
              />
            </div>
            <Input
              variant="partner"
              id="review-tag"
              name="tag"
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => handleTagKey(event, addTag)}
              className="text-[12px]"
              placeholder="#태그를 입력하세요 (엔터로 추가)"
            />
            <EditableTagList
              tags={tags}
              onRemove={(tag) =>
                setTags((items) => items.filter((item) => item !== tag))
              }
            />
          </FormSection>
          <Button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={submit}
          >
            {submitting
              ? "저장 중..."
              : editReview
                ? "리뷰 수정하기"
                : "리뷰 등록하기"}
          </Button>
        </section>
      </div>
    </>
  );
}

function WriteHeader({
  title,
  onCancel,
  logoTitle = false,
  action,
}: {
  title: string;
  onCancel: () => void;
  logoTitle?: boolean;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 grid h-[calc(64px_+_env(safe-area-inset-top))] grid-cols-[56px_1fr_minmax(56px,auto)] items-center border-b border-[var(--border)] bg-[var(--surface)]/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <button
        type="button"
        aria-label="닫기"
        onClick={onCancel}
        className="flex h-11 w-11 items-center justify-center text-[var(--fg)]"
      >
        <X size={24} strokeWidth={2} />
      </button>
      <h1
        className={cn(
          "text-center font-bold text-[var(--fg-strong)]",
          logoTitle ? "logo-wordmark text-[24px]" : "text-[18px]",
        )}
      >
        {title}
      </h1>
      {action ?? <div aria-hidden className="h-11 w-11" />}
    </header>
  );
}

function CategoryChips({
  selected,
  onSelect,
  error = false,
}: {
  selected: PartnerCategoryValue | null;
  onSelect: (category: PartnerCategoryValue) => void;
  error?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-3 rounded-[var(--radius-lg)]",
        error && "outline outline-1 outline-[var(--accent)]",
      )}
    >
      {writableCategories.map((category) => (
        <button
          key={category.value}
          type="button"
          onClick={() => onSelect(category.value)}
          className={categoryChipClass(selected === category.value)}
        >
          {category.label}
        </button>
      ))}
    </div>
  );
}

function PartnerReviewImageUploadSection({
  attachedImages,
  onAttachImages,
  onOpenNativePicker,
  onRemoveImage,
}: {
  attachedImages: AttachedImage[];
  onAttachImages: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenNativePicker?: () => void;
  onRemoveImage: (image: AttachedImage) => void;
}) {
  return (
    <ImageAttachmentSection
      title="이미지/첨부 파일"
      images={attachedImages}
      limit={REVIEW_ATTACHMENT_LIMIT}
      accept={PARTNER_ATTACHMENT_ACCEPT}
      inputName="reviewImages"
      ariaPrefix="리뷰"
      addLabel="파일 첨부"
      countUnit="개"
      onAttachImages={onAttachImages}
      onOpenNativePicker={onOpenNativePicker}
      onRemoveImage={onRemoveImage}
    />
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-4 text-[16px] font-bold tracking-[-0.01em] text-[var(--fg-strong)]">
        {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function EditableTagList({
  tags,
  onRemove,
}: {
  tags: string[];
  onRemove: (tag: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onRemove(tag)}
          className="rounded-[var(--radius-pill)] bg-[var(--surface-alt)] px-3 py-1.5 text-[12px] font-medium text-[var(--fg)]"
        >
          {tag} ×
        </button>
      ))}
    </div>
  );
}

function SpecTable({
  rows,
  className,
}: {
  rows: Array<[string, string]>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)]",
        className,
      )}
    >
      {rows.map(([label, value], index) => (
        <div
          key={label}
          className={cn(
            "grid grid-cols-[minmax(78px,0.34fr)_minmax(0,1fr)] sm:grid-cols-[112px_minmax(0,1fr)]",
            index > 0 && "border-t border-[var(--border-strong)]",
          )}
        >
          <div className="min-w-0 bg-[var(--surface-alt)] px-3 py-4 text-[14px] font-bold text-[var(--fg-muted)] [overflow-wrap:anywhere] sm:px-4">
            {label}
          </div>
          <div className="min-w-0 px-3 py-4 text-[14px] font-bold text-[var(--fg)] [overflow-wrap:anywhere] sm:px-4">
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

function TagList({ tags, className }: { tags: string[]; className?: string }) {
  const visibleTags = displayTags(tags);
  if (visibleTags.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {visibleTags.map((tag) => (
        <span
          key={tag}
          className="max-w-full rounded-[var(--radius-pill)] bg-[var(--surface-alt)] px-4 py-2 text-[13px] font-medium text-[var(--fg)] [overflow-wrap:anywhere]"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function AttachmentDownloadList({
  attachments,
  className,
}: {
  attachments: PartnerAttachment[];
  className?: string;
}) {
  if (attachments.length === 0) return null;

  return (
    <section className={className}>
      <h2 className="mb-3 text-[18px] font-bold leading-[1.35] tracking-[-0.01em] text-[var(--fg-strong)]">
        첨부 파일
      </h2>
      <div className="space-y-2">
        {attachments.map((attachment) => (
          <a
            key={attachment.url}
            href={attachment.url}
            download={attachment.name}
            target="_blank"
            rel="noreferrer"
            className="grid grid-cols-[36px_minmax(0,1fr)_28px] items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-strong)] px-4 py-3 text-[var(--fg)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-alt)] text-[var(--fg-muted)]">
              <FileText size={19} strokeWidth={1.8} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-bold leading-[1.4]">
                {attachment.name}
              </span>
              <span className="mt-0.5 block text-[12px] leading-[1.4] text-[var(--fg-muted)]">
                {formatFileSize(attachment.size)}
              </span>
            </span>
            <Download size={18} className="text-[var(--fg-muted)]" />
          </a>
        ))}
      </div>
    </section>
  );
}

function formatFileSize(size: number) {
  if (!size) return "파일";
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)}KB`;
  return `${(size / 1024 / 1024).toFixed(1)}MB`;
}

function Pagination({
  page,
  totalPages,
  onChange,
  className,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-7 text-[14px] text-[var(--fg-muted)]",
        className,
      )}
    >
      {Array.from({ length: Math.min(totalPages, 5) }).map((_, index) => {
        const pageNumber = index + 1;
        return (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onChange(pageNumber)}
            className={cn(
              "tabular-nums",
              page === pageNumber
                ? "font-bold text-[var(--accent)]"
                : "text-[var(--fg-muted)]",
            )}
          >
            {pageNumber}
          </button>
        );
      })}
      {totalPages > 5 ? <span>...</span> : null}
    </div>
  );
}

function StickyAction({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 mx-auto box-border w-full max-w-[var(--app-shell-max-width)] border-t border-[var(--border)] bg-[var(--surface)]/95 px-5 pb-[calc(var(--app-safe-area-bottom)+12px)] pt-3 backdrop-blur-xl">
      {children}
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
    <div className="rounded-[var(--radius-lg)] bg-[var(--surface-alt)] px-5 py-10 text-center">
      <p className="text-[16px] font-bold text-[var(--fg-strong)]">{title}</p>
      {description ? (
        <p className="mt-2 text-[14px] text-[var(--fg-muted)]">{description}</p>
      ) : null}
    </div>
  );
}

function ConfirmModal({
  message,
  onCancel,
  onConfirm,
}: {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-6">
      <div className="w-full max-w-[360px] rounded-[var(--radius-xl)] bg-[var(--surface)] p-6 shadow-[var(--shadow-modal)]">
        <p className="text-[18px] font-bold leading-[1.35] tracking-[-0.01em] text-[var(--fg)]">
          {message}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[var(--radius-lg)] border border-[var(--border-strong)] py-4 text-[16px] font-bold text-[var(--fg)]"
          >
            계속 작성
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-[var(--radius-lg)] bg-[var(--accent)] py-4 text-[16px] font-bold text-white"
          >
            나가기
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div className="fixed inset-x-0 bottom-24 z-50 mx-auto max-w-[var(--app-shell-max-width)] px-6">
      <div className="rounded-[var(--radius-lg)] bg-[var(--fg)] px-4 py-3 text-center text-[14px] font-bold text-[var(--surface)] shadow-[var(--shadow-modal)]">
        {message}
      </div>
    </div>
  );
}
