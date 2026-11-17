import { type NextRequest, NextResponse } from "next/server";
import type { EventCategory } from "@/domain/community/types";
import { normalizeEventApplyUrl } from "@/domain/community/eventApplyUrl";
import { getMongoDb, toDomain } from "@/infrastructure/mongodb/client";
import { activeAccountFilter } from "@/infrastructure/server/accountStatus";
import { getCurrentUser } from "@/infrastructure/server/auth";
import {
  createId,
  eventCategoryOrNull,
  nowIso,
} from "@/infrastructure/server/content";
import { sendPushNotification } from "@/infrastructure/server/pushNotifications";
import { requireContentWriteAllowed } from "@/infrastructure/server/sanctions";
import {
  PROHIBITED_PUBLIC_CONTENT,
  prohibitedPublicContent,
} from "@/infrastructure/server/ugcModeration";
import {
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";

type EventRequestBody = {
  title: string;
  body: string;
  imageUrl?: string;
  schedule?: string;
  time?: string;
  category?: EventCategory;
  applyUrl?: string;
  location?: string;
  address?: string;
};

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  try {
    await requireContentWriteAllowed(user.id);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "작성할 수 없습니다.",
      403,
    );
  }

  const body = await readJson<EventRequestBody>(request);
  const title = requireString(body.title);
  const content = requireString(body.body);

  if (!title || !content) return jsonError("제목과 내용을 입력해주세요.");
  if (prohibitedPublicContent(title, content))
    return jsonError(
      PROHIBITED_PUBLIC_CONTENT.message,
      400,
      PROHIBITED_PUBLIC_CONTENT.code,
    );

  const category = eventCategoryOrNull(body.category);
  if (!category) return jsonError("이벤트 카테고리를 확인해주세요.");
  const applyUrl = normalizeEventApplyUrl(body.applyUrl);
  if (applyUrl === null) return jsonError("신청 링크를 확인해주세요.");

  const db = await getMongoDb();
  const document = {
    id: createId("event-request"),
    title,
    body: content,
    imageUrl: body.imageUrl,
    schedule: body.schedule,
    time: body.time,
    category,
    ...(applyUrl ? { applyUrl } : {}),
    ...optionalText(body.location, "location"),
    ...optionalText(body.address, "address"),
    status: "pending",
    requesterId: user.id,
    createdAt: nowIso(),
  };

  await db.collection("community_event_requests").insertOne(document);
  await notifyEventRequestAdmins(document.id, document.title);
  return NextResponse.json(toDomain(document), { status: 201 });
}

function optionalText(value: string | undefined, key: "location" | "address") {
  const text = value?.trim();
  return text ? { [key]: text } : {};
}

async function notifyEventRequestAdmins(requestId: string, title: string) {
  try {
    const db = await getMongoDb();
    const admins = await db
      .collection<{ id: string }>("users")
      .find({ role: "admin", ...activeAccountFilter() })
      .project<{ id: string }>({ id: 1, _id: 0 })
      .toArray();
    await Promise.all(
      admins.map((admin) =>
        sendPushNotification(admin.id, {
          title: "새 이벤트 요청",
          body: title,
          data: { href: `/content/event-requests/${requestId}` },
        }),
      ),
    );
  } catch (error) {
    console.warn("[event-request] admin push failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
