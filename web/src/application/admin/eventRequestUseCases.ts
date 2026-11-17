import type {
  AdminCommunityEventInput,
  AdminContentDto,
  AdminEventRequestDto,
  DecideEventRequestInput,
  EventRequestStatus,
} from "@blending/admin-contracts";
import type { ClientSession } from "mongodb";
import type { AdminContentSearchRepository } from "./contentUseCases";

export class EventRequestConflictError extends Error {}
export class EventRequestValidationError extends Error {}

export type EventRequestRepository = {
  decidePending(
    id: string,
    decision: {
      status: Exclude<EventRequestStatus, "pending">;
      decidedAt: string;
      decidedBy: string;
      decisionReason: string;
      eventId?: string;
    },
    session: ClientSession,
  ): Promise<AdminEventRequestDto | null>;
  createEvent(
    id: string,
    requestId: string,
    input: AdminCommunityEventInput,
    session: ClientSession,
  ): Promise<AdminContentDto>;
};

export function parseDecideEventRequestInput(
  value: unknown,
): DecideEventRequestInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new EventRequestValidationError("처리 입력을 확인해주세요.");
  const input = value as Record<string, unknown>;
  const reason = requiredText(input.reason, "처리 사유");
  if (input.decision === "reject") return { decision: "reject", reason };
  if (
    input.decision !== "approve" ||
    !input.event ||
    typeof input.event !== "object" ||
    Array.isArray(input.event)
  )
    throw new EventRequestValidationError("승인할 행사 정보를 확인해주세요.");
  const event = input.event as Record<string, unknown>;
  const category = event.category;
  if (
    category !== "official" &&
    category !== "seminar" &&
    category !== "meetup"
  )
    throw new EventRequestValidationError("행사 분류를 확인해주세요.");
  const startsAt = dateText(event.startsAt, "시작일");
  const endsAt =
    event.endsAt == null || event.endsAt === ""
      ? undefined
      : dateText(event.endsAt, "종료일");
  if (endsAt && Date.parse(startsAt) >= Date.parse(endsAt))
    throw new EventRequestValidationError("행사 기간을 확인해주세요.");
  return {
    decision: "approve",
    reason,
    event: {
      title: requiredText(event.title, "제목"),
      category,
      startsAt,
      ...(endsAt ? { endsAt } : {}),
      location: requiredText(event.location, "장소"),
      address: requiredText(event.address, "주소"),
      description: requiredText(event.description, "설명"),
      ...optionalUrl(event.imageUrl, "이미지"),
      ...optionalUrl(event.posterUrl, "포스터"),
      ...optionalUrl(event.applyUrl, "신청 URL"),
    },
  };
}

export async function decideEventRequest(
  repository: EventRequestRepository,
  search: AdminContentSearchRepository,
  actor: { id: string },
  requestId: string,
  input: DecideEventRequestInput,
  eventId: string,
  session: ClientSession,
): Promise<AdminEventRequestDto> {
  const reason = input.reason.trim();
  if (!reason)
    throw new EventRequestValidationError("처리 사유를 입력해주세요.");

  const decision = await repository.decidePending(
    requestId,
    {
      status: input.decision === "approve" ? "approved" : "rejected",
      decidedAt: new Date().toISOString(),
      decidedBy: actor.id,
      decisionReason: reason,
      ...(input.decision === "approve" ? { eventId } : {}),
    },
    session,
  );
  if (!decision) throw new EventRequestConflictError("이미 처리된 요청입니다.");

  if (input.decision === "approve") {
    const event = await repository.createEvent(
      eventId,
      requestId,
      {
        kind: "community_event",
        ...input.event,
        imageUrl: input.event.imageUrl ?? "",
        posterUrl: input.event.posterUrl ?? input.event.imageUrl ?? "",
      },
      session,
    );
    await search.upsert(event, session);
  }
  return decision;
}

function requiredText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim())
    throw new EventRequestValidationError(`${label}을(를) 입력해주세요.`);
  return value.trim();
}

function dateText(value: unknown, label: string) {
  const text = requiredText(value, label);
  if (Number.isNaN(Date.parse(text)))
    throw new EventRequestValidationError(`${label}을(를) 확인해주세요.`);
  return text;
}

function optionalUrl(value: unknown, label: string) {
  if (value == null || value === "") return {};
  const text = requiredText(value, label);
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:")
      throw new Error();
  } catch {
    throw new EventRequestValidationError(`${label}을(를) 확인해주세요.`);
  }
  return {
    [label === "이미지"
      ? "imageUrl"
      : label === "포스터"
        ? "posterUrl"
        : "applyUrl"]: text,
  };
}
