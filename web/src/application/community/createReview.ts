import type { EventCategory, EventReview } from "@/domain/community/types";
import {
  PROHIBITED_PUBLIC_CONTENT,
  prohibitedPublicContent,
} from "@/domain/community/publicContentPolicy";

export class ReviewForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "작성할 수 없습니다.") {
    super(message);
    this.name = "ReviewForbiddenError";
  }
}

export class ReviewValidationError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message);
    this.name = "ReviewValidationError";
    this.code = options?.code;
    this.status = options?.status ?? 400;
  }
}

export type AuthenticatedReviewUser = {
  id: string;
  handle?: string | null;
};

export type CreateReviewInput = {
  eventId?: string;
  title?: string;
  category?: string;
  authorName?: string;
  authorHandle?: string;
  imageUrls?: string[];
  keywords?: string[];
  body?: string;
  [key: string]: unknown;
};

export type LoadReviewInput = () => Promise<CreateReviewInput>;

export type AssertCanWrite = (userId: string) => Promise<void>;
export type IndexReview = (review: EventReview) => Promise<void>;
export type CreateId = (prefix: string) => string;
export type NowIso = () => string;

export interface ReviewWriteRepository {
  save(review: EventReview, ownerId: string): Promise<EventReview>;
}

export type CreateReviewPorts = {
  assertCanWrite: AssertCanWrite;
  reviewRepository: ReviewWriteRepository;
  indexReview: IndexReview;
  createId: CreateId;
  nowIso: NowIso;
};

const validCategories = new Set<EventCategory>([
  "official",
  "seminar",
  "meetup",
]);

function parseCategory(value: unknown): EventCategory | null {
  return typeof value === "string" &&
    validCategories.has(value as EventCategory)
    ? (value as EventCategory)
    : null;
}

function firstOrFallback(
  value: string | null | undefined,
  fallback: string,
): string {
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function compactStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    )
    .map((value) => value.trim());
}

export async function createReview(
  user: AuthenticatedReviewUser,
  loadInput: LoadReviewInput,
  ports: CreateReviewPorts,
): Promise<EventReview & { isOwner: true }> {
  try {
    await ports.assertCanWrite(user.id);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "작성할 수 없습니다.";
    throw new ReviewForbiddenError(message);
  }

  const body = await loadInput();

  const title =
    typeof body.title === "string" && body.title.trim().length > 0
      ? body.title.trim()
      : null;
  const content =
    typeof body.body === "string" && body.body.trim().length > 0
      ? body.body.trim()
      : null;

  if (!title || !content) {
    throw new ReviewValidationError("제목과 내용을 입력해주세요.");
  }

  const keywords = compactStrings(body.keywords);
  const prohibited = prohibitedPublicContent(title, content, ...keywords);
  if (prohibited) {
    throw new ReviewValidationError(PROHIBITED_PUBLIC_CONTENT.message, {
      code: PROHIBITED_PUBLIC_CONTENT.code,
      status: 400,
    });
  }

  const category = body.category ? parseCategory(body.category) : "meetup";
  if (!category) {
    throw new ReviewValidationError("후기 카테고리를 확인해주세요.");
  }

  const review: EventReview = {
    id: ports.createId("review"),
    eventId: body.eventId ?? "custom",
    title,
    category,
    author: {
      name: firstOrFallback(user.handle ?? body.authorName, "익명"),
      handle: firstOrFallback(body.authorHandle ?? user.handle, "anonymous"),
    },
    createdAt: ports.nowIso(),
    imageUrls: compactStrings(body.imageUrls),
    keywords,
    likes: 0,
    body: content,
  };

  const savedReview = await ports.reviewRepository.save(review, user.id);
  await ports.indexReview(review);

  return {
    ...savedReview,
    isOwner: true,
  };
}
