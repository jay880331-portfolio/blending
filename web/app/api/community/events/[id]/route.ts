import { type NextRequest, NextResponse } from "next/server";
import type { CommunityEvent, EventCategory } from "@/domain/community/types";
import { normalizeEventApplyUrl } from "@/domain/community/eventApplyUrl";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import {
  deleteSourceSearchDocument,
  upsertEventSearchDocument,
} from "@/infrastructure/mongodb/searchMongoRepository";
import { eventCategoryOrNull } from "@/infrastructure/server/content";
import { getCurrentAdminUser } from "@/infrastructure/server/auth";
import {
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type UpdateEventRequest = {
  title: string;
  category: EventCategory;
  description: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string;
  address: string;
  imageUrl?: string;
  posterUrl?: string;
  applyUrl?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentContentType?: string;
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const admin = await getCurrentAdminUser(request);
  if (!admin) return jsonError("관리자 권한이 필요합니다.", 403);

  const body = await readJson<UpdateEventRequest>(request);
  const title = requireString(body.title);
  const description = requireString(body.description);
  const startsAt = dateOrNull(body.startsAt);
  const endsAt = dateOrNull(body.endsAt);
  const allDay = booleanOrNull(body.allDay);
  const location = requireString(body.location);
  const address = requireString(body.address);
  const category = eventCategoryOrNull(body.category);
  const imageUrl = assetUrlOrNull(body.imageUrl);
  const posterUrl = assetUrlOrNull(body.posterUrl);
  const applyUrl = normalizeEventApplyUrl(body.applyUrl);
  const attachmentUrl = assetUrlOrNull(body.attachmentUrl);
  const attachmentName = optionalString(body.attachmentName);
  const attachmentContentType = optionalString(body.attachmentContentType);

  if (!title || !description)
    return jsonError("이벤트 제목과 내용을 입력해주세요.");
  if (!category) return jsonError("이벤트 카테고리를 확인해주세요.");
  if (!startsAt) return jsonError("시작 일시를 확인해주세요.");
  if (!endsAt || Date.parse(startsAt) >= Date.parse(endsAt))
    return jsonError("종료 일정은 시작 일정 이후여야 합니다.");
  if (allDay === null) return jsonError("종일 여부를 확인해주세요.");
  if (!location || !address) return jsonError("장소와 주소를 입력해주세요.");
  if (imageUrl === null || posterUrl === null)
    return jsonError("이미지 URL을 확인해주세요.");
  if (applyUrl === null) return jsonError("신청 링크를 확인해주세요.");
  if (
    attachmentUrl === null ||
    (attachmentUrl &&
      (!attachmentName || attachmentContentType !== "application/pdf"))
  )
    return jsonError("첨부 파일을 확인해주세요.");

  const { id } = await params;
  const db = await getMongoDb();
  const event = await db
    .collection<CommunityEvent>("community_events")
    .findOne({ id });
  if (!event) return jsonError("일정을 찾을 수 없습니다.", 404);

  const updatedEvent: CommunityEvent = {
    ...event,
    title,
    category,
    description,
    startsAt,
    endsAt,
    allDay,
    location,
    address,
    imageUrl: imageUrl ?? event.imageUrl,
    posterUrl: posterUrl ?? event.posterUrl,
    ...(applyUrl ? { applyUrl } : {}),
    ...(attachmentUrl
      ? { attachmentUrl, attachmentName, attachmentContentType }
      : {}),
  };
  if (!applyUrl) delete updatedEvent.applyUrl;
  if (!attachmentUrl) {
    delete updatedEvent.attachmentUrl;
    delete updatedEvent.attachmentName;
    delete updatedEvent.attachmentContentType;
  }

  const result = await db
    .collection<CommunityEvent>("community_events")
    .updateOne(
      { id },
      {
        $set: {
          title: updatedEvent.title,
          category: updatedEvent.category,
          description: updatedEvent.description,
          startsAt: updatedEvent.startsAt,
          endsAt: updatedEvent.endsAt,
          allDay: updatedEvent.allDay,
          location: updatedEvent.location,
          address: updatedEvent.address,
          imageUrl: updatedEvent.imageUrl,
          posterUrl: updatedEvent.posterUrl,
          ...(applyUrl ? { applyUrl } : {}),
          ...(attachmentUrl
            ? { attachmentUrl, attachmentName, attachmentContentType }
            : {}),
        },
        $unset: {
          ...(applyUrl ? {} : { applyUrl: "" }),
          ...(attachmentUrl
            ? {}
            : {
                attachmentUrl: "",
                attachmentName: "",
                attachmentContentType: "",
              }),
        },
      },
    );
  if (result.matchedCount === 0)
    return jsonError("일정을 찾을 수 없습니다.", 404);
  await upsertEventSearchDocument(updatedEvent);

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const admin = await getCurrentAdminUser(request);
  if (!admin) return jsonError("관리자 권한이 필요합니다.", 403);

  const { id } = await params;
  const db = await getMongoDb();
  const result = await db
    .collection<CommunityEvent>("community_events")
    .deleteOne({ id });
  if (result.deletedCount === 0)
    return jsonError("일정을 찾을 수 없습니다.", 404);
  await deleteSourceSearchDocument("community_event", id);

  return NextResponse.json({ success: true });
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
