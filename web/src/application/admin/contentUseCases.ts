import type {
  AdminContentDto,
  AdminContentInput,
  AdminContentKind,
  AdminContentState,
} from "@blending/admin-contracts";
import type { ClientSession } from "mongodb";

const EVENT_CATEGORIES = ["official", "seminar", "meetup"] as const;
const ROAST_CATEGORIES = ["light", "medium", "dark"] as const;
const PARTNER_CATEGORIES = [
  "espresso-machine",
  "grinder",
  "ice-equipment",
  "brewing-roaster",
  "ingredient",
  "supplies",
] as const;

export class AdminContentValidationError extends Error {}
export class AdminContentUseCaseNotFoundError extends Error {}

export function parseAdminContentInput(
  kind: AdminContentKind,
  value: unknown,
): AdminContentInput {
  const input = record(value);
  if (input.kind !== kind)
    throw new AdminContentValidationError("kind가 일치하지 않습니다.");

  switch (kind) {
    case "community_event":
      return {
        kind,
        title: text(input, "title"),
        category: choice(input, "category", EVENT_CATEGORIES),
        startsAt: dateTime(input, "startsAt"),
        ...optionalDateTime(input, "endsAt"),
        location: text(input, "location"),
        address: text(input, "address"),
        imageUrl: url(input, "imageUrl"),
        posterUrl: url(input, "posterUrl"),
        description: text(input, "description"),
        ...optionalUrl(input, "applyUrl"),
      };
    case "community_review":
      return {
        kind,
        ownerId: text(input, "ownerId"),
        eventId: text(input, "eventId"),
        title: text(input, "title"),
        category: choice(input, "category", EVENT_CATEGORIES),
        authorName: text(input, "authorName"),
        ...optionalText(input, "authorHandle"),
        ...optionalUrl(input, "authorAvatarUrl"),
        body: text(input, "body"),
        imageUrls: urls(input, "imageUrls"),
        keywords: texts(input, "keywords"),
      };
    case "community_b_talk":
      return {
        kind,
        ownerId: text(input, "ownerId"),
        title: text(input, "title"),
        roast: choice(input, "roast", ROAST_CATEGORIES),
        authorName: text(input, "authorName"),
        ...optionalText(input, "authorHandle"),
        ...optionalUrl(input, "authorAvatarUrl"),
        ...optionalUrl(input, "coverUrl"),
        processImages: urls(input, "processImages"),
        bean: stringObject(input, "bean", ["origin", "process", "roastPoint"]),
        extraction: stringObject(input, "extraction", [
          "dosing",
          "yield",
          "time",
          "temp",
        ]),
        note: text(input, "note"),
      };
    case "community_qa":
      return {
        kind,
        ownerId: text(input, "ownerId"),
        title: text(input, "title"),
        authorName: text(input, "authorName"),
        ...optionalUrl(input, "authorAvatarUrl"),
        body: text(input, "body"),
        imageUrls: urls(input, "imageUrls"),
      };
    case "partner_promotion":
      return {
        kind,
        ownerId: text(input, "ownerId"),
        title: text(input, "title"),
        category: choice(input, "category", PARTNER_CATEGORIES),
        companyName: text(input, "companyName"),
        authorName: text(input, "authorName"),
        ...optionalUrl(input, "authorAvatarUrl"),
        summary: text(input, "summary"),
        description: text(input, "description"),
        thumbnailUrl: url(input, "thumbnailUrl"),
        imageUrls: urls(input, "imageUrls"),
        ...optionalAttachments(input),
        brochureUrls: urls(input, "brochureUrls"),
        tags: texts(input, "tags"),
        ...optionalUrl(input, "externalUrl"),
        specs: stringObject(input, "specs", [
          "companyName",
          "productName",
          "categoryLabel",
        ]),
      };
    case "partner_review":
      return {
        kind,
        ownerId: text(input, "ownerId"),
        promotionId: text(input, "promotionId"),
        productName: text(input, "productName"),
        category: choice(input, "category", PARTNER_CATEGORIES),
        brand: text(input, "brand"),
        modelName: text(input, "modelName"),
        features: text(input, "features"),
        reviewerName: text(input, "reviewerName"),
        ...optionalUrl(input, "reviewerAvatarUrl"),
        ...optionalUrl(input, "reviewerResumeUrl"),
        summary: text(input, "summary"),
        body: text(input, "body"),
        imageUrls: urls(input, "imageUrls"),
        ...optionalAttachments(input),
        tags: texts(input, "tags"),
        majorPros: texts(input, "majorPros"),
        baristaTip: text(input, "baristaTip"),
        ...optionalUrl(input, "relatedUrl"),
      };
    case "partner_banner": {
      const sortOrder = input.sortOrder;
      if (!Number.isInteger(sortOrder) || (sortOrder as number) < 0)
        throw new AdminContentValidationError("sortOrder를 확인해주세요.");
      const activeFrom = dateTime(input, "activeFrom");
      const activeTo = dateTime(input, "activeTo");
      if (Date.parse(activeFrom) >= Date.parse(activeTo))
        throw new AdminContentValidationError("배너 노출 기간을 확인해주세요.");
      return {
        kind,
        title: text(input, "title"),
        subtitle: text(input, "subtitle"),
        imageUrl: url(input, "imageUrl"),
        href: url(input, "href", true),
        sortOrder: sortOrder as number,
        activeFrom,
        activeTo,
      };
    }
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AdminContentValidationError("콘텐츠 입력을 확인해주세요.");
  return value as Record<string, unknown>;
}

function text(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (typeof value !== "string" || !value.trim())
    throw new AdminContentValidationError(`${key}를 확인해주세요.`);
  return value.trim();
}

function optionalText(input: Record<string, unknown>, key: string) {
  if (!Object.hasOwn(input, key)) return {};
  const value = input[key];
  return value === null || value === ""
    ? { [key]: null }
    : { [key]: text(input, key) };
}

function choice<const T extends readonly string[]>(
  input: Record<string, unknown>,
  key: string,
  values: T,
): T[number] {
  const value = text(input, key);
  if (!values.includes(value))
    throw new AdminContentValidationError(`${key}를 확인해주세요.`);
  return value as T[number];
}

function texts(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw new AdminContentValidationError(`${key}를 확인해주세요.`);
  return value
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function url(input: Record<string, unknown>, key: string, relative = false) {
  const value = text(input, key);
  if (relative && value.startsWith("/")) return value;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      throw new Error();
  } catch {
    throw new AdminContentValidationError(`${key} URL을 확인해주세요.`);
  }
  return value;
}

function optionalUrl(input: Record<string, unknown>, key: string) {
  if (!Object.hasOwn(input, key)) return {};
  return input[key] === null || input[key] === ""
    ? { [key]: null }
    : { [key]: url(input, key) };
}

function urls(input: Record<string, unknown>, key: string) {
  const values = texts(input, key).slice(0, 10);
  return values.map((value) => url({ [key]: value }, key));
}

function dateTime(input: Record<string, unknown>, key: string) {
  const value = text(input, key);
  if (Number.isNaN(Date.parse(value)))
    throw new AdminContentValidationError(`${key}를 확인해주세요.`);
  return value;
}

function optionalDateTime(input: Record<string, unknown>, key: string) {
  if (!Object.hasOwn(input, key)) return {};
  return input[key] === null || input[key] === ""
    ? { [key]: null }
    : { [key]: dateTime(input, key) };
}

function stringObject<const K extends string>(
  input: Record<string, unknown>,
  key: string,
  keys: readonly K[],
): Record<K, string> {
  const value = record(input[key]);
  return Object.fromEntries(
    keys.map((name) => [name, text(value, name)]),
  ) as Record<K, string>;
}

function optionalAttachments(input: Record<string, unknown>) {
  if (!Object.hasOwn(input, "attachments")) return {};
  if (input.attachments === null || input.attachments === "")
    return { attachments: null };
  if (!Array.isArray(input.attachments) || input.attachments.length > 10)
    throw new AdminContentValidationError("attachments를 확인해주세요.");
  return {
    attachments: input.attachments.map((value) => {
      const item = record(value);
      const size = item.size;
      if (typeof size !== "number" || size < 0 || !Number.isFinite(size))
        throw new AdminContentValidationError(
          "attachment size를 확인해주세요.",
        );
      return {
        url: url(item, "url"),
        name: text(item, "name"),
        size,
        contentType: text(item, "contentType"),
      };
    }),
  };
}

export type AdminContentMutationRepository = {
  create(
    kind: AdminContentKind,
    id: string,
    input: AdminContentInput,
    session: ClientSession,
  ): Promise<AdminContentDto>;
  update(
    kind: AdminContentKind,
    id: string,
    input: AdminContentInput,
    session: ClientSession,
  ): Promise<AdminContentUpdateResult>;
  findById(
    kind: AdminContentKind,
    id: string,
    session: ClientSession,
  ): Promise<AdminContentDto | null>;
  changeState(
    kind: AdminContentKind,
    id: string,
    state: AdminContentState,
    reason: string,
    session: ClientSession,
  ): Promise<AdminContentMutationResult>;
};

export type AdminContentMutationResult = {
  content: AdminContentDto;
  changed: boolean;
};

export type AdminContentUpdateResult = {
  content: AdminContentDto;
  ownerClaimed: boolean;
};

export type AdminContentSearchRepository = {
  upsert(content: AdminContentDto, session: ClientSession): Promise<void>;
  remove(
    kind: AdminContentKind,
    id: string,
    session: ClientSession,
  ): Promise<void>;
};

export async function createContent(
  repository: AdminContentMutationRepository,
  search: AdminContentSearchRepository,
  kind: AdminContentKind,
  id: string,
  input: AdminContentInput,
  session: ClientSession,
) {
  const content = await repository.create(kind, id, input, session);
  await search.upsert(content, session);
  return content;
}

export async function updateContent(
  repository: AdminContentMutationRepository,
  search: AdminContentSearchRepository,
  kind: AdminContentKind,
  id: string,
  input: AdminContentInput,
  session: ClientSession,
) {
  const result = await repository.update(kind, id, input, session);
  if (result.content.state === "active")
    await search.upsert(result.content, session);
  else await search.remove(kind, id, session);
  return result;
}

export async function hideContent(
  _repository: AdminContentMutationRepository,
  _search: AdminContentSearchRepository,
  _kind: AdminContentKind,
  _id: string,
  _reason: string,
  _session: ClientSession,
): Promise<AdminContentMutationResult> {
  return changeContentState(
    _repository,
    _search,
    _kind,
    _id,
    "hidden",
    _reason,
    _session,
  );
}

export async function restoreContent(
  _repository: AdminContentMutationRepository,
  _search: AdminContentSearchRepository,
  _kind: AdminContentKind,
  _id: string,
  _reason: string,
  _session: ClientSession,
): Promise<AdminContentMutationResult> {
  return changeContentState(
    _repository,
    _search,
    _kind,
    _id,
    "active",
    _reason,
    _session,
  );
}

export async function deleteContent(
  repository: AdminContentMutationRepository,
  search: AdminContentSearchRepository,
  kind: AdminContentKind,
  id: string,
  reason: string,
  session: ClientSession,
): Promise<AdminContentMutationResult> {
  return changeContentState(
    repository,
    search,
    kind,
    id,
    "deleted",
    reason,
    session,
  );
}

async function changeContentState(
  repository: AdminContentMutationRepository,
  search: AdminContentSearchRepository,
  kind: AdminContentKind,
  id: string,
  state: AdminContentState,
  reason: string,
  session: ClientSession,
) {
  const normalizedReason = reason.trim();
  if (!normalizedReason)
    throw new AdminContentValidationError("변경 사유를 입력해주세요.");

  const current = await repository.findById(kind, id, session);
  if (!current) throw new AdminContentUseCaseNotFoundError();
  if (current.state === state) return { content: current, changed: false };

  const result = await repository.changeState(
    kind,
    id,
    state,
    normalizedReason,
    session,
  );
  if (!result.changed) return result;
  if (state === "active") await search.upsert(result.content, session);
  else await search.remove(kind, id, session);
  return result;
}
