"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Heart, MapPin, MessageSquare } from "lucide-react";
import { fetchStoreBeans } from "@/adapters/http/beanApi";
import {
  createBrewGuideApi,
  fetchAuthorizedBrewGuideStores,
} from "@/adapters/http/brewGuideApi";
import {
  BREW_GUIDE_TITLE_MAX_LENGTH,
  type BrewGuide,
} from "@/domain/brewGuide/brewGuide";
import type { ShowroomBean } from "@/domain/showroom/bean";
import {
  BrewGuideFormFields,
  buildBrewGuideRecipesFromDraft,
  createInitialBrewGuideDraft,
  type BrewGuideRecipeDraft,
} from "@/ui/brewGuide/BrewGuideFormFields";
import {
  fetchPickedDailyNotes,
  createDailyNote,
  createDailyNoteComment,
  deleteDailyNoteComment,
  deleteDailyNote,
  likeDailyNote,
  likeDailyNoteComment,
  updateDailyNote,
  updateDailyNoteComment,
} from "@/adapters/http/dailyNoteApi";
import { MAX_UPLOAD_IMAGE_SIZE, uploadImages } from "@/adapters/http/uploadApi";
import {
  dailyNoteTechnicalEntries,
  formatDailyNoteTechnical,
  runSingleFlight,
  type DailyNote,
  type DailyNoteComment,
  type DailyNoteFeedItem,
  type DailyNoteTechnicals,
} from "@/domain/daily-note/dailyNote";
import { useDailyNoteStore } from "@/store/dailyNoteStore";
import { CommentThread } from "@/ui/shared/CommentThread";
import { Button } from "@/ui/shared/Button";
import { DetailAuthorMeta } from "@/ui/shared/DetailAuthorMeta";
import { ImageAttachmentSection } from "@/ui/shared/ImageAttachmentSection";
import {
  attachedImageFiles,
  createAttachedImage,
  filterImageFiles,
  IMAGE_ACCEPT,
  moveImage,
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
import {
  PostcodeSearchField,
  type PostcodeSelection,
} from "@/ui/shared/PostcodeSearchField";
import { CommunityShell } from "@/ui/community/CommunityShell";
import { ContentActionMenu } from "@/ui/community/ContentActionMenu";
import { buildProfileHref } from "@/ui/shared/profileNavigation";

type DailyNoteAppProps = { view: string[] };
export function DailyNoteApp({ view }: DailyNoteAppProps) {
  const second = view[1];
  if (second === "pick") return <DailyNotePickScreen view={view} />;
  if (second === "new") return <DailyNoteWriteScreen view={view} />;
  if (second) return <DailyNoteDetailScreen id={second} view={view} />;
  return <DailyNoteFeedScreen view={view} />;
}

export function shouldObserveDailyNoteFeed(
  nextCursor: string | undefined,
  loadingMore: boolean,
  error: string | undefined,
) {
  return Boolean(nextCursor && !loadingMore && !error);
}

export function assembleDailyNoteImageUrls(
  images: Array<Pick<AttachedImage, "url" | "file">>,
  uploadedImageUrls: string[],
) {
  let uploadedIndex = 0;
  return images
    .flatMap((image) =>
      image.file ? [uploadedImageUrls[uploadedIndex++] ?? ""] : [image.url],
    )
    .filter(Boolean);
}

function DailyNoteFeedScreen({ view }: DailyNoteAppProps) {
  const feed = useDailyNoteStore((state) => state.feed);
  const status = useDailyNoteStore((state) => state.status);
  const loadingMore = useDailyNoteStore((state) => state.loadingMore);
  const nextCursor = useDailyNoteStore((state) => state.nextCursor);
  const error = useDailyNoteStore((state) => state.error);
  const loadFeed = useDailyNoteStore((state) => state.loadFeed);
  const retryFeed = useDailyNoteStore((state) => state.retryFeed);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void loadFeed(true);
  }, [loadFeed]);
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !shouldObserveDailyNoteFeed(nextCursor, loadingMore, error))
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadFeed();
      },
      { rootMargin: "0px 0px 320px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [error, loadFeed, loadingMore, nextCursor]);

  return (
    <CommunityShell activeTab="daily-note" view={view}>
      {status === "loading" && feed.length === 0 ? <DailyNoteSkeleton /> : null}
      {status === "error" && feed.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="text-[14px] font-bold text-[var(--fg-muted)]">
            {error ?? "STORY를 불러오지 못했습니다."}
          </p>
          <button
            type="button"
            onClick={() => void loadFeed(true)}
            className="mt-4 text-[14px] font-bold text-[var(--accent)]"
          >
            다시 시도
          </button>
        </div>
      ) : null}
      {feed.length ? <DailyNoteGrid notes={feed} /> : null}
      {status === "ready" && feed.length === 0 ? (
        <p className="px-6 py-20 text-center text-[14px] font-bold text-[var(--fg-muted)]">
          아직 기록이 없어요. 첫 STORY를 남겨보세요.
        </p>
      ) : null}
      <div ref={sentinelRef} className="h-px" />
      {loadingMore ? <DailyNoteSkeleton compact /> : null}
      {error && feed.length ? (
        <div className="py-6 text-center">
          <button
            type="button"
            onClick={() => void retryFeed()}
            className="text-[14px] font-bold text-[var(--accent)]"
          >
            다시 시도
          </button>
        </div>
      ) : null}
    </CommunityShell>
  );
}

function DailyNotePickScreen({ view }: DailyNoteAppProps) {
  const [notes, setNotes] = useState<DailyNote[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const busy = useRef(false);
  const generation = useRef(0);
  const likeRequests = useRef(new Set<string>());
  const sentinel = useRef<HTMLDivElement>(null);
  const updateLike = useDailyNoteStore((state) => state.updateLike);

  async function load(next?: string) {
    if (busy.current) return;
    busy.current = true;
    const request = generation.current;
    setLoading(true);
    setError(undefined);
    try {
      const page = await fetchPickedDailyNotes(next);
      if (request !== generation.current) return;
      setNotes((previous) =>
        next
          ? [
              ...previous,
              ...page.items.filter(
                (item) => !previous.some((note) => note.id === item.id),
              ),
            ]
          : page.items,
      );
      setCursor(page.nextCursor);
    } catch (cause) {
      if (request === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "PICK을 불러오지 못했습니다.",
        );
    } finally {
      if (request === generation.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }
  useEffect(() => {
    busy.current = false;
    const request = generation.current;
    void Promise.resolve().then(() => {
      if (request === generation.current) void load();
    });
    return () => {
      generation.current += 1;
    };
  }, []);
  useEffect(() => {
    if (!sentinel.current || !cursor || loading || error) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void load(cursor);
      },
      { rootMargin: "320px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [cursor, loading, error]);

  const togglePickLike = (note: DailyNote) =>
    runSingleFlight(likeRequests.current, note.id, async () => {
      setFeedback(undefined);
      try {
        const nextLiked = !note.liked;
        const result = await likeDailyNote(note.id, nextLiked);
        updateLike(note.id, result.liked, result.likeCount);
        setNotes((current) =>
          current.map((item) =>
            item.id === note.id
              ? { ...item, liked: result.liked, likeCount: result.likeCount }
              : item,
          ),
        );
      } catch (cause) {
        setFeedback(
          cause instanceof Error
            ? cause.message
            : "좋아요 반영에 실패했습니다.",
        );
      }
    });

  return (
    <CommunityShell activeTab="pick" view={view}>
      {feedback ? (
        <p role="alert" className="ds-body px-6 text-[var(--danger)]">
          {feedback}
        </p>
      ) : null}
      {notes.map((note) => {
        const detailHref = `/community/daily-note/${note.id}`;
        return (
          <article
            key={note.id}
            className="border-b border-[var(--border)] pb-4"
          >
            <DetailAuthorMeta
              compact
              className="min-h-14 px-4 py-3"
              name={note.author.nickname}
              avatarUrl={note.author.avatarUrl}
              profileHref={
                note.author.isBarista
                  ? `/showroom/${encodeURIComponent(note.author.id)}`
                  : buildProfileHref(
                      note.author.id,
                      "/community/daily-note/pick",
                    )
              }
            />
            <ImageDetailSlider
              images={note.imageUrls}
              maxImages={10}
              square
              className="mt-0"
            />
            <div className="px-4">
              <div className="flex items-center gap-1 py-1">
                <button
                  type="button"
                  aria-label={note.liked ? "좋아요 취소" : "좋아요"}
                  aria-pressed={note.liked}
                  onClick={() => void togglePickLike(note)}
                  className={`-ms-2 flex h-11 w-11 items-center justify-center ${
                    note.liked ? "text-[var(--accent)]" : "text-[var(--fg)]"
                  }`}
                >
                  <Heart
                    size={25}
                    strokeWidth={1.8}
                    fill={note.liked ? "currentColor" : "none"}
                  />
                </button>
                <Link
                  href={detailHref}
                  aria-label="STORY 상세 및 댓글 보기"
                  className="flex h-11 w-11 items-center justify-center text-[var(--fg)]"
                >
                  <MessageSquare size={25} strokeWidth={1.8} />
                </Link>
              </div>
              <p className="ds-body font-bold">좋아요 {note.likeCount}개</p>
              {note.note ? (
                <Link
                  href={detailHref}
                  className="ds-body mt-1 block line-clamp-2"
                  dir="auto"
                >
                  <span className="font-bold">{note.author.nickname}</span>{" "}
                  {note.note}
                </Link>
              ) : null}
              <Link
                href={detailHref}
                className="ds-body mt-1 inline-flex min-h-11 items-center text-[var(--fg-muted)]"
              >
                {note.commentCount > 0
                  ? `댓글 ${note.commentCount}개 모두 보기`
                  : "댓글 남기기"}
              </Link>
              <time
                dateTime={note.createdAt}
                className="ds-label block text-[var(--fg-subtle)]"
              >
                {formatDate(note.createdAt)}
              </time>
            </div>
          </article>
        );
      })}
      {!loading && !error && notes.length === 0 ? (
        <p className="ds-body px-6 py-20 text-center text-[var(--fg-muted)]">
          즐겨찾기한 사람의 새로운 STORY가 이곳에 표시됩니다.
        </p>
      ) : null}
      {loading ? <DailyNoteSkeleton compact /> : null}
      {error ? (
        <div role="alert" className="px-6 py-8 text-center">
          <p className="ds-body">{error}</p>
          <Button variant="secondary" onClick={() => void load(cursor)}>
            다시 시도
          </Button>
        </div>
      ) : null}
      <div ref={sentinel} className="h-px" />
    </CommunityShell>
  );
}

function DailyNoteGrid({ notes }: { notes: DailyNoteFeedItem[] }) {
  return (
    <div className="grid grid-cols-3 gap-1 bg-[var(--surface)] p-4">
      {notes.map((note) => {
        const featured = note.featuredTechnicalKeys
          .map((key) => formatDailyNoteTechnical(key, note.technicals[key]))
          .filter(Boolean);
        return (
          <Link
            key={note.id}
            href={`/community/daily-note/${note.id}`}
            className="relative aspect-square overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)]"
          >
            <Image
              src={note.imageUrls[0] ?? ""}
              alt=""
              fill
              sizes="33vw"
              className="object-cover"
            />
            {featured.length ? (
              <div className="absolute bottom-2 end-2 flex max-w-[calc(100%-16px)] flex-col items-end gap-1">
                {featured.map((value) => (
                  <span
                    key={value}
                    className="max-w-full truncate rounded-[var(--radius-pill)] bg-[var(--fg)]/70 px-2.5 py-1.5 text-[10px] font-bold text-[var(--surface)]"
                  >
                    {value}
                  </span>
                ))}
              </div>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

function DailyNoteDetailScreen({ id, view }: { id: string; view: string[] }) {
  const router = useRouter();
  const note = useDailyNoteStore((state) => state.details[id]);
  const loadDetail = useDailyNoteStore((state) => state.loadDetail);
  const updateLike = useDailyNoteStore((state) => state.updateLike);
  const updateComments = useDailyNoteStore((state) => state.updateComments);
  const remove = useDailyNoteStore((state) => state.remove);
  const detailStatus = useDailyNoteStore((state) => state.detailStatus[id]);
  const detailError = useDailyNoteStore((state) => state.detailErrors[id]);
  const [comment, setComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [feedback, setFeedback] = useState<string>();
  const [deleting, setDeleting] = useState(false);
  const likeRequests = useRef(new Set<string>());

  useEffect(() => {
    void loadDetail(id);
  }, [id, loadDetail]);

  if (!note) {
    return (
      <CommunityShell activeTab="daily-note" view={view}>
        {detailStatus === "error" ? (
          <div className="px-6 py-16 text-center">
            <p className="text-[14px] font-bold text-[var(--fg-muted)]">
              {detailError ?? "STORY를 불러오지 못했습니다."}
            </p>
            <button
              type="button"
              onClick={() => void loadDetail(id)}
              className="mt-4 text-[14px] font-bold text-[var(--accent)]"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <DailyNoteSkeleton />
        )}
      </CommunityShell>
    );
  }
  const featured = note.featuredTechnicalKeys
    .map((key) => formatDailyNoteTechnical(key, note.technicals[key]))
    .filter(Boolean);
  const toggleLike = () =>
    runSingleFlight(likeRequests.current, note.id, async () => {
      setFeedback(undefined);
      const previous = { liked: note.liked, likeCount: note.likeCount };
      const liked = !note.liked;
      updateLike(note.id, liked, note.likeCount + (liked ? 1 : -1));
      try {
        const result = await likeDailyNote(note.id, liked);
        updateLike(note.id, result.liked, result.likeCount);
      } catch (error) {
        updateLike(note.id, previous.liked, previous.likeCount);
        setFeedback(
          error instanceof Error
            ? error.message
            : "좋아요를 반영하지 못했습니다.",
        );
      }
    });
  const submitComment = async () => {
    const body = comment.trim();
    if (!body || submittingComment) return;
    const pending: DailyNoteComment = {
      id: `pending-${Date.now()}`,
      authorName: "나",
      createdAgo: "방금 전",
      body,
      likes: 0,
    };
    const current = note.comments ?? [];
    setSubmittingComment(true);
    setComment("");
    setFeedback(undefined);
    updateComments(note.id, [...current, pending]);
    try {
      const created = await createDailyNoteComment(note.id, body);
      updateComments(note.id, [...current, created]);
    } catch (error) {
      updateComments(note.id, current);
      setComment(body);
      setFeedback(
        error instanceof Error ? error.message : "댓글 등록에 실패했습니다.",
      );
    } finally {
      setSubmittingComment(false);
    }
  };
  const canManage = note.canManage ?? note.isOwner;
  const removeNote = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteDailyNote(note.id);
      remove(note.id);
      router.push("/community/daily-note");
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "STORY 삭제에 실패했습니다.",
      );
      setDeleting(false);
    }
  };

  return (
    <CommunityShell
      activeTab="daily-note"
      view={view}
      headerAction={
        <ContentActionMenu
          editHref={
            canManage ? `/community/daily-note/new?edit=${note.id}` : undefined
          }
          onDelete={canManage ? removeNote : undefined}
          deleting={deleting}
          label="STORY"
          report={
            !canManage
              ? { targetId: note.id, authorId: note.author.id }
              : undefined
          }
        />
      }
    >
      <article className="pb-8">
        <ImageDetailSlider
          images={note.imageUrls}
          maxImages={10}
          square
          className="mt-0"
          overlay={
            featured.length ? (
              <div className="absolute left-3 top-3 flex max-w-[calc(100%-24px)] gap-1">
                {featured.map((value) => (
                  <span
                    key={value}
                    className="max-w-full truncate rounded-[var(--radius-pill)] bg-[var(--fg)]/70 px-2.5 py-1 text-[12px] font-bold text-[var(--surface)]"
                  >
                    {value}
                  </span>
                ))}
              </div>
            ) : null
          }
        />
        <div className="space-y-6 px-6 pt-6">
          <DetailAuthorMeta
            name={note.author.nickname}
            date={formatDate(note.createdAt)}
            avatarUrl={note.author.avatarUrl}
            affiliation={note.author.affiliation}
            isBarista={note.author.isBarista}
            profileHref={
              note.author.isBarista
                ? `/showroom/${encodeURIComponent(note.author.id)}`
                : buildProfileHref(
                    note.author.id,
                    `/community/daily-note/${note.id}`,
                  )
            }
          />
          {note.location ? (
            <div className="flex items-start gap-2 text-[13px] text-[var(--fg-muted)]">
              <MapPin size={16} className="mt-0.5 shrink-0" />
              <span>
                <b className="font-bold text-[var(--fg)]">
                  {note.location.name}
                </b>
                <br />
                {note.location.address}
              </span>
            </div>
          ) : null}
          <div className="flex items-center gap-5 text-[14px] text-[var(--fg-muted)]">
            <button
              type="button"
              onClick={() => void toggleLike()}
              className="flex items-center gap-1.5"
            >
              <Heart
                size={18}
                className={
                  note.liked ? "fill-[var(--accent)] text-[var(--accent)]" : ""
                }
              />
              {note.likeCount}
            </button>
            <span className="flex items-center gap-1.5">
              <MessageSquare size={18} />
              {note.commentCount}
            </span>
          </div>
          {feedback ? (
            <p
              role="alert"
              className="text-[13px] font-bold text-[var(--accent)]"
            >
              {feedback}
            </p>
          ) : null}
          {note.note ? (
            <section>
              <h2 className="text-[13px] font-bold text-[var(--fg-muted)]">
                NOTE
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-[var(--fg)]">
                {note.note}
              </p>
            </section>
          ) : null}
          {dailyNoteTechnicalEntries(note.technicals).length ? (
            <TechnicalSpec technicals={note.technicals} />
          ) : null}
          <CommentThread
            contentId={note.id}
            comments={note.comments ?? []}
            commentCount={note.commentCount}
            value={comment}
            submitting={submittingComment}
            getLikeState={(item) => ({
              liked: Boolean(item.liked),
              likes: item.likes,
            })}
            onToggleLike={(item) => {
              if (item.id.startsWith("pending-")) return;
              const liked = !item.liked;
              const patchComment = (
                commentId: string,
                patch: Partial<DailyNoteComment>,
              ) => {
                const current =
                  useDailyNoteStore.getState().details[note.id]?.comments ?? [];
                updateComments(
                  note.id,
                  current.map((commentItem) =>
                    commentItem.id === commentId
                      ? { ...commentItem, ...patch }
                      : commentItem,
                  ),
                );
              };
              patchComment(item.id, {
                liked,
                likes: item.likes + (liked ? 1 : -1),
              });
              void likeDailyNoteComment(note.id, item.id, liked).then(
                (result) => {
                  patchComment(item.id, {
                    liked: result.liked,
                    likes: result.likes,
                  });
                },
                () => {
                  patchComment(item.id, {
                    liked: item.liked,
                    likes: item.likes,
                  });
                  setFeedback("좋아요를 반영하지 못했습니다.");
                },
              );
            }}
            onChange={setComment}
            onSubmit={() => void submitComment()}
            onUpdate={(_, commentId, body) =>
              updateComments(
                note.id,
                (note.comments ?? []).map((item) =>
                  item.id === commentId ? { ...item, body } : item,
                ),
              )
            }
            onRemove={(_, commentId) =>
              updateComments(
                note.id,
                (note.comments ?? []).filter((item) => item.id !== commentId),
              )
            }
            requestUpdate={updateDailyNoteComment}
            requestDelete={deleteDailyNoteComment}
            alwaysShowInput
          />
        </div>
      </article>
    </CommunityShell>
  );
}

function TechnicalSpec({ technicals }: { technicals: DailyNoteTechnicals }) {
  return (
    <section>
      <h2 className="text-[13px] font-bold text-[var(--fg-muted)]">
        기술 스펙
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-px border border-[var(--border)] bg-[var(--border)]">
        {dailyNoteTechnicalEntries(technicals).map((item) => (
          <div key={item.key} className="bg-[var(--surface)] p-4">
            <p className="text-[12px] text-[var(--fg-muted)]">{item.label}</p>
            <p className="mt-1 break-words text-[14px] font-bold text-[var(--fg)]">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DailyNoteWriteScreen({ view }: DailyNoteAppProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const fromHome = searchParams.get("from") === "home";
  const prepend = useDailyNoteStore((state) => state.prepend);
  const replace = useDailyNoteStore((state) => state.replace);
  const loadDetail = useDailyNoteStore((state) => state.loadDetail);
  const editNote = useDailyNoteStore((state) =>
    editId ? state.details[editId] : undefined,
  );
  const submitting = useDailyNoteStore((state) => state.submitting);
  const setSubmitting = useDailyNoteStore((state) => state.setSubmitting);
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [note, setNote] = useState("");
  const [location, setLocation] = useState<{ name: string; address: string }>();
  const [locationOpen, setLocationOpen] = useState(false);
  const [toast, setToast] = useState<string>();
  const [toastRole, setToastRole] = useState<"status" | "alert">("status");
  const showToast = (message: string, role: "status" | "alert" = "status") => {
    setToast(message);
    setToastRole(role);
  };
  useAttachedImageCleanup(images);
  useEffect(() => {
    if (editId) void loadDetail(editId);
  }, [editId, loadDetail]);
  useEffect(() => {
    if (!editNote) return;
    const timeout = window.setTimeout(() => {
      setImages(editNote.imageUrls.map(createExistingDailyNoteImage));
      setNote(editNote.note ?? "");
      setLocation(editNote.location);
    });
    return () => window.clearTimeout(timeout);
  }, [editNote]);
  const { startImageCrop, imageCropEditor } = useImageCropFlow(
    (files) =>
      setImages((current) =>
        [...current, ...files.map(createAttachedImage)].slice(0, 10),
      ),
    { fixedAspect: "square", touchOnly: true },
  );
  const attachFiles = (files: File[]) => {
    const remaining = 10 - images.length;
    if (!remaining) return;
    if (files.length > remaining)
      showToast(`사진은 ${remaining}장만 더 추가할 수 있어요.`);
    startImageCrop(
      filterImageFiles(
        files.slice(0, remaining),
        MAX_UPLOAD_IMAGE_SIZE,
        (message) => showToast(message, "alert"),
      ),
    );
  };
  const onAttachImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    attachFiles(files);
  };
  const submit = async () => {
    if (!images.length || submitting) return;
    setSubmitting(true);
    try {
      const uploadedImageUrls = await uploadImages(
        attachedImageFiles(images),
        "daily-notes",
      );
      const imageUrls = assembleDailyNoteImageUrls(images, uploadedImageUrls);
      const input = {
        imageUrls,
        note,
        technicals: editNote?.technicals ?? {},
        featuredTechnicalKeys: editNote?.featuredTechnicalKeys ?? [],
        ...(location ? { location } : {}),
      };
      const saved = editId
        ? await updateDailyNote(editId, input)
        : await createDailyNote(input);
      if (editId) replace(saved);
      else prepend(saved);
      router.push("/community/daily-note");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : `STORY ${editId ? "수정" : "등록"}에 실패했습니다.`,
        "alert",
      );
    } finally {
      setSubmitting(false);
    }
  };
  const selectLocation = ({ data, address }: PostcodeSelection) => {
    setLocation({ name: data.buildingName.trim() || address, address });
    setLocationOpen(false);
  };

  return (
    <CommunityShell
      activeTab="daily-note"
      view={view}
      hideTabs
      bottomNavActive={fromHome ? "home" : "partner"}
    >
      {imageCropEditor}
      <div className="space-y-8 px-6 py-7 pb-32">
        <h1 className="text-[20px] font-bold text-[var(--fg-strong)]">
          {editId ? "수정하기" : "등록하기"}
        </h1>
        <ImageAttachmentSection
          images={images}
          limit={10}
          accept={IMAGE_ACCEPT}
          inputName="dailyNoteImages"
          ariaPrefix="STORY"
          onAttachImages={onAttachImages}
          onOpenNativePicker={
            isNativeImagePickerAvailable()
              ? async () =>
                  attachFiles(
                    (await pickNativeImageFiles(10 - images.length)) ?? [],
                  )
              : undefined
          }
          onRemoveImage={(image) => {
            revokeAttachedImages([image]);
            setImages((current) =>
              current.filter((item) => item.id !== image.id),
            );
          }}
          onMoveImage={(from, to) =>
            setImages((current) => moveImage(current, from, to))
          }
        />
        <label className="block rounded-[var(--radius-md)] border border-[var(--border-strong)] p-4 focus-within:border-[var(--accent)]">
          <span className="text-[13px] font-bold text-[var(--fg-muted)]">
            NOTE
          </span>
          <textarea
            value={note}
            maxLength={2000}
            onChange={(event) => setNote(event.target.value)}
            placeholder="오늘의 커피를 기록해보세요."
            className="mt-3 min-h-32 w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-[var(--fg-subtle)]"
          />
        </label>
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-bold">장소</h2>
            <button
              type="button"
              aria-label="장소 검색"
              onClick={() => setLocationOpen((open) => !open)}
              className="flex h-11 w-11 items-center justify-center text-[var(--fg)]"
            >
              <MapPin size={21} />
            </button>
          </div>
          {location ? (
            <p className="mt-2 text-[13px] text-[var(--fg-muted)]">
              {location.name} · {location.address}
            </p>
          ) : null}
          {locationOpen ? (
            <div className="mt-4">
              <PostcodeSearchField
                postalCode=""
                baseAddress={location?.address ?? ""}
                detailAddress=""
                onComplete={selectLocation}
                onDetailAddressChange={() => undefined}
              />
            </div>
          ) : null}
        </section>
        <DailyNoteBrewGuideSection
          key={editNote?.id ?? "new"}
          initialTechnicals={editNote?.technicals}
        />
        {toast ? (
          <p
            role={toastRole}
            className="text-[13px] font-bold text-[var(--accent)]"
          >
            {toast}
          </p>
        ) : null}
      </div>
      <div className="fixed inset-x-0 bottom-[var(--app-bottom-nav-height)] z-30 mx-auto max-w-[var(--app-shell-max-width)] border-t border-[var(--border)] bg-[var(--surface)] p-4">
        <Button
          type="button"
          disabled={submitting || !images.length}
          onClick={() => void submit()}
        >
          {submitting
            ? `${editId ? "수정" : "등록"} 중...`
            : editId
              ? "수정하기"
              : "등록하기"}
        </Button>
      </div>
    </CommunityShell>
  );
}

function DailyNoteBrewGuideSection({
  initialTechnicals,
}: {
  initialTechnicals?: DailyNoteTechnicals;
}) {
  const [stores, setStores] = useState<
    Array<{ id: string; storeName: string }>
  >([]);
  const [open, setOpen] = useState(false);
  const [storeId, setStoreId] = useState("");
  const [beans, setBeans] = useState<ShowroomBean[]>([]);
  const [beanId, setBeanId] = useState("");
  const [title, setTitle] = useState(initialTechnicals?.beanName ?? "");
  const [draft, setDraft] = useState<BrewGuideRecipeDraft>(() =>
    createInitialBrewGuideDraft({
      waterTemperatureC: initialTechnicals?.waterTemperatureC,
      extractionTimeSec: initialTechnicals?.extractionTimeSec,
    }),
  );
  const [saving, setSaving] = useState(false);
  const [savedGuide, setSavedGuide] = useState<BrewGuide | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAuthorizedBrewGuideStores()
      .then((list) => {
        if (cancelled || list.length === 0) return;
        setStores(list);
        setStoreId((prev) => prev || list[0].id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open || !storeId) return;
    let cancelled = false;
    fetchStoreBeans(storeId)
      .then((list) => {
        if (!cancelled) setBeans(list);
      })
      .catch(() => {
        if (!cancelled) setBeans([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, storeId]);

  if (stores.length === 0) return null;

  const handleSaveGuide = async () => {
    if (!storeId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const recipes = buildBrewGuideRecipesFromDraft(draft);
      const created = await createBrewGuideApi({
        storeId,
        beanId: beanId || null,
        title,
        ...recipes,
      });
      setSavedGuide(created);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "브루 가이드 저장에 실패했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] p-4">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[15px] font-bold text-[var(--fg-strong)]">
          브루 가이드 만들기 (선택)
        </span>
        <span className="text-[12px] font-medium text-[var(--fg-muted)]">
          {open ? "접기" : "펼치기"}
        </span>
      </button>

      {open ? (
        <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <label className="block">
              <span className="text-[12px] font-medium text-[var(--fg-muted)]">
                매장
              </span>
              <select
                value={storeId}
                onChange={(e) => {
                  setStoreId(e.target.value);
                  setBeanId("");
                }}
                className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[14px] outline-none"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.storeName}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[12px] font-medium text-[var(--fg-muted)]">
                연결 원두 (선택)
              </span>
              <select
                value={beanId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setBeanId(nextId);
                  const matched = beans.find((b) => b.id === nextId);
                  if (matched && !title.trim()) {
                    setTitle(matched.name);
                  }
                }}
                className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[14px] outline-none"
              >
                <option value="">연결 안 함</option>
                {beans.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.unit})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-[12px] font-medium text-[var(--fg-muted)]">
              원두명(제목)
            </span>
            <input
              type="text"
              maxLength={BREW_GUIDE_TITLE_MAX_LENGTH}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 에티오피아 예가체프"
              className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]"
            />
          </label>

          <BrewGuideFormFields draft={draft} onChange={setDraft} />

          {error ? (
            <p className="text-[12px] font-bold text-[var(--danger)]">
              {error}
            </p>
          ) : null}

          {savedGuide ? (
            <p className="text-[12px] font-bold text-[var(--success)]">
              저장됨:{" "}
              <Link href={`/brew-guide/${savedGuide.id}`} className="underline">
                브루 가이드 카드 보기
              </Link>
            </p>
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveGuide()}
              className="rounded-[var(--radius-md)] bg-[var(--fg)] px-4 py-2 text-[13px] font-bold text-[var(--surface)] disabled:opacity-50"
            >
              {saving ? "저장 중..." : "브루 가이드 저장"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function createExistingDailyNoteImage(
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

function DailyNoteSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-1 p-4">
      {Array.from({ length: compact ? 3 : 12 }).map((_, index) => (
        <div
          key={index}
          className="aspect-square animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-alt)]"
        />
      ))}
    </div>
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}
