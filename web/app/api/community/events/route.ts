import { type NextRequest, NextResponse } from "next/server";
import type { CommunityEvent, EventCategory } from "@/domain/community/types";
import { normalizeEventApplyUrl } from "@/domain/community/eventApplyUrl";
import { getMongoDb, toDomain } from "@/infrastructure/mongodb/client";
import { upsertEventSearchDocument } from "@/infrastructure/mongodb/searchMongoRepository";
import {
  createId,
  eventCategoryOrNull,
  firstOrFallback,
  nowIso,
} from "@/infrastructure/server/content";
import { getCurrentAdminUser } from "@/infrastructure/server/auth";
import {
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";

type CreateEventRequest = {
  title: string;
  category?: EventCategory;
  startsAt?: string;
  endsAt?: string;
  allDay?: boolean;
  location?: string;
  address?: string;
  imageUrl?: string;
  posterUrl?: string;
  description?: string;
  applyUrl?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentContentType?: string;
};

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdminUser(request);
  if (!admin) return jsonError("관리자 권한이 필요합니다.", 403);

  const body = await readJson<CreateEventRequest>(request);
  const title = requireString(body.title);
  if (!title) return jsonError("이벤트 제목을 입력해주세요.");

  const category = body.category
    ? eventCategoryOrNull(body.category)
    : "meetup";
  if (!category) return jsonError("이벤트 카테고리를 확인해주세요.");
  const allDay = booleanOrNull(body.allDay);
  if (allDay === null) return jsonError("종일 여부를 확인해주세요.");
  const applyUrl = normalizeEventApplyUrl(body.applyUrl);
  if (applyUrl === null) return jsonError("신청 링크를 확인해주세요.");
  const startsAt = body.startsAt ? dateOrNull(body.startsAt) : nowIso();
  const endsAt = body.endsAt ? dateOrNull(body.endsAt) : undefined;
  if (!startsAt || (body.endsAt && !endsAt))
    return jsonError("일정 일시를 확인해주세요.");
  if (endsAt && Date.parse(startsAt) >= Date.parse(endsAt))
    return jsonError("종료 일정은 시작 일정 이후여야 합니다.");
  const attachmentUrl = assetUrlOrNull(body.attachmentUrl);
  const attachmentName = optionalString(body.attachmentName);
  const attachmentContentType = optionalString(body.attachmentContentType);
  if (
    attachmentUrl === null ||
    (attachmentUrl &&
      (!attachmentName || attachmentContentType !== "application/pdf"))
  )
    return jsonError("첨부 파일을 확인해주세요.");

  const event: CommunityEvent = {
    id: createId("event"),
    title,
    category,
    startsAt,
    ...(endsAt ? { endsAt } : {}),
    allDay,
    location: firstOrFallback(body.location, "장소 미정"),
    address: firstOrFallback(body.address, "주소 미정"),
    imageUrl: firstOrFallback(body.imageUrl, "/favicon.ico"),
    posterUrl: firstOrFallback(body.posterUrl ?? body.imageUrl, "/favicon.ico"),
    description: firstOrFallback(body.description, ""),
    ...(applyUrl ? { applyUrl } : {}),
    ...(attachmentUrl
      ? { attachmentUrl, attachmentName, attachmentContentType }
      : {}),
  };

  const db = await getMongoDb();
  await db.collection<CommunityEvent>("community_events").insertOne(event);
  await upsertEventSearchDocument(event);

  return NextResponse.json(toDomain(event), { status: 201 });
}

function dateOrNull(value: unknown) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function assetUrlOrNull(value: unknown) {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return undefined;
  if (text.startsWith("/")) return text;
  return normalizeEventApplyUrl(text);
}

function optionalString(value: unknown) {
  if (value == null || value === "") return undefined;
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function booleanOrNull(value: unknown) {
  if (value == null) return false;
  return typeof value === "boolean" ? value : null;
}
