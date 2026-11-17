import type {
  FaqInput,
  GuideContentDto,
  GuideContentInput,
  GuideContentKind,
  NoticeInput,
  PolicyInput,
} from "@blending/admin-contracts";
import type { ClientSession } from "mongodb";
import { parseAdminListQuery } from "./adminListQuery";

export class GuideContentValidationError extends Error {}
export class GuideContentNotFoundError extends Error {}
export class GuideContentConflictError extends Error {}

const GUIDE_CONTENT_SORTS = ["createdAt", "updatedAt", "publishedAt"] as const;
const GUIDE_CONTENT_LIST_KEYS = new Set([
  "q",
  "status",
  "deleted",
  "sort",
  "direction",
  "page",
  "pageSize",
]);

export function parseGuideContentListQuery(params: URLSearchParams) {
  for (const key of params.keys())
    if (!GUIDE_CONTENT_LIST_KEYS.has(key))
      throw new GuideContentValidationError("지원하지 않는 조회 조건입니다.");
  const direction = params.get("direction");
  if (direction && direction !== "asc" && direction !== "desc")
    throw new GuideContentValidationError("정렬 방향을 확인해주세요.");
  const deleted = params.get("deleted");
  if (deleted && deleted !== "true" && deleted !== "false")
    throw new GuideContentValidationError("삭제 상태를 확인해주세요.");
  const q = params.get("q")?.trim();
  if (q && (q.length < 2 || q.length > 100))
    throw new GuideContentValidationError("검색어는 2~100자로 입력해주세요.");
  const status = params.get("status");
  if (status && status !== "draft" && status !== "published")
    throw new GuideContentValidationError("발행 상태를 확인해주세요.");
  try {
    const base = parseAdminListQuery(params, GUIDE_CONTENT_SORTS);
    return {
      page: base.page,
      pageSize: base.pageSize,
      direction: base.direction,
      ...(q ? { q } : {}),
      ...(status ? { status: status as "draft" | "published" } : {}),
      ...(deleted ? { deleted: deleted === "true" } : {}),
      ...(base.sort ? { sort: base.sort } : {}),
    };
  } catch (error) {
    throw new GuideContentValidationError(
      error instanceof Error ? error.message : "조회 조건을 확인해주세요.",
    );
  }
}

export type GuideContentMutationRepository = {
  create(
    kind: GuideContentKind,
    id: string,
    input: GuideContentInput,
    actorId: string,
    session: ClientSession,
  ): Promise<GuideContentDto>;
  update(
    kind: GuideContentKind,
    id: string,
    input: GuideContentInput,
    actorId: string,
    session: ClientSession,
  ): Promise<GuideContentDto | null>;
  changeDeleted(
    kind: GuideContentKind,
    id: string,
    deleted: boolean,
    actorId: string,
    session: ClientSession,
  ): Promise<GuideContentDto | null>;
};

export type PublicGuideContentRepository = {
  listPublic(
    kind: "notice" | "faq",
    now: Date,
  ): Promise<Array<GuideContentDto | Record<string, unknown>>>;
};

export function parseGuideContentInput(
  kind: GuideContentKind,
  value: unknown,
): GuideContentInput {
  const input = record(value);
  const status = choice(input.status, ["draft", "published"], "status");
  const publishedAt = optionalDate(input.publishedAt, "발행 시각");
  if (status === "published" && !publishedAt)
    throw new GuideContentValidationError("발행 시각을 입력해주세요.");
  const publish = publishedAt ? { publishedAt } : {};
  if (kind === "notice")
    return {
      title: text(input.title, "title"),
      body: text(input.body, "body"),
      status,
      ...publish,
    } satisfies NoticeInput;
  if (kind === "faq") {
    const sortOrder = input.sortOrder;
    if (!Number.isInteger(sortOrder) || (sortOrder as number) < 0)
      throw new GuideContentValidationError("sortOrder를 확인해주세요.");
    return {
      category: choice(input.category, ["guide", "account"], "category"),
      question: text(input.question, "question"),
      answer: text(input.answer, "answer"),
      sortOrder: sortOrder as number,
      status,
      ...publish,
    } satisfies FaqInput;
  }
  const slug = text(input.slug, "slug");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new GuideContentValidationError("slug를 확인해주세요.");
  if (!Number.isInteger(input.version) || (input.version as number) < 1)
    throw new GuideContentValidationError("version을 확인해주세요.");
  return {
    slug,
    title: text(input.title, "title"),
    body: text(input.body, "body"),
    version: input.version as number,
    effectiveAt: date(input.effectiveAt, "적용 시각"),
    status,
    ...publish,
  } satisfies PolicyInput;
}

export async function createGuideContent(
  repository: Pick<GuideContentMutationRepository, "create">,
  kind: GuideContentKind,
  id: string,
  input: GuideContentInput,
  actorId: string,
  session: ClientSession,
) {
  try {
    return await repository.create(kind, id, input, actorId, session);
  } catch (error) {
    if (isDuplicate(error))
      throw new GuideContentConflictError("이미 존재하는 정책 버전입니다.");
    throw error;
  }
}

export async function updateGuideContent(
  repository: Pick<GuideContentMutationRepository, "update">,
  kind: GuideContentKind,
  id: string,
  input: GuideContentInput,
  actorId: string,
  session: ClientSession,
) {
  try {
    const result = await repository.update(kind, id, input, actorId, session);
    if (!result) throw new GuideContentNotFoundError();
    return result;
  } catch (error) {
    if (isDuplicate(error))
      throw new GuideContentConflictError("이미 존재하는 정책 버전입니다.");
    throw error;
  }
}

export async function changeGuideContentDeleted(
  repository: Pick<GuideContentMutationRepository, "changeDeleted">,
  kind: GuideContentKind,
  id: string,
  deleted: boolean,
  actorId: string,
  session: ClientSession,
) {
  const result = await repository.changeDeleted(
    kind,
    id,
    deleted,
    actorId,
    session,
  );
  if (!result) throw new GuideContentNotFoundError();
  return result;
}

export async function listPublicNotices(
  repository: PublicGuideContentRepository,
  now: Date,
) {
  return repository.listPublic("notice", now);
}

export async function listPublicFaqs(
  repository: PublicGuideContentRepository,
  now: Date,
) {
  const items = await repository.listPublic("faq", now);
  return [...items].sort((a, b) => {
    const left = faqSortOrder(a);
    const right = faqSortOrder(b);
    return left - right || String(a.id).localeCompare(String(b.id));
  });
}

function faqSortOrder(value: GuideContentDto | Record<string, unknown>) {
  if ("sortOrder" in value) return Number(value.sortOrder);
  return "data" in value &&
    !!value.data &&
    typeof value.data === "object" &&
    "sortOrder" in value.data
    ? Number(value.data.sortOrder)
    : 0;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new GuideContentValidationError("콘텐츠 입력을 확인해주세요.");
  return value as Record<string, unknown>;
}
function text(value: unknown, name: string) {
  if (typeof value !== "string" || !value.trim())
    throw new GuideContentValidationError(`${name}를 확인해주세요.`);
  return value.trim();
}
function choice<const T extends readonly string[]>(
  value: unknown,
  values: T,
  name: string,
): T[number] {
  if (typeof value !== "string" || !values.includes(value))
    throw new GuideContentValidationError(`${name}를 확인해주세요.`);
  return value as T[number];
}
function date(value: unknown, name: string) {
  const result = text(value, name);
  if (Number.isNaN(Date.parse(result)))
    throw new GuideContentValidationError(`${name}을 확인해주세요.`);
  return new Date(result).toISOString();
}
function optionalDate(value: unknown, name: string) {
  return value === undefined || value === null || value === ""
    ? undefined
    : date(value, name);
}
function isDuplicate(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === 11000
  );
}
