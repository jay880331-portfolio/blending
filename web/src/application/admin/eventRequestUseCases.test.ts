import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  AdminEventRequestDto,
  AdminContentDto,
} from "@blending/admin-contracts";
import type { ClientSession } from "mongodb";
import {
  decideEventRequest,
  EventRequestConflictError,
  EventRequestValidationError,
  parseDecideEventRequestInput,
  type EventRequestRepository,
} from "./eventRequestUseCases";

const session = {} as ClientSession;
const approval = {
  decision: "approve" as const,
  reason: "게시 승인",
  event: {
    title: "커피 모임",
    category: "meetup" as const,
    startsAt: "2026-08-01T09:00:00.000Z",
    location: "서울",
    address: "서울시",
    description: "행사 설명",
  },
};

function fixture(failCreate = false) {
  const state: { request: AdminEventRequestDto; events: AdminContentDto[] } = {
    request: {
      id: "request-1",
      requesterId: "user-1",
      title: "요청",
      body: "내용",
      status: "pending",
      createdAt: "2026-07-01T00:00:00.000Z",
    },
    events: [],
  };
  const repository: EventRequestRepository = {
    async decidePending(id, decision) {
      if (id !== state.request.id || state.request.status !== "pending")
        return null;
      state.request = { ...state.request, ...decision };
      return state.request;
    },
    async createEvent(id, requestId, input) {
      if (failCreate) throw new Error("event insert failed");
      if (
        state.events.some(
          (event) =>
            event.data.kind === "community_event" &&
            (event as AdminContentDto & { requestId?: string }).requestId ===
              requestId,
        )
      )
        throw new Error("duplicate");
      const event: AdminContentDto = {
        id,
        kind: "community_event",
        state: "active",
        title: input.title,
        views: 0,
        likes: 0,
        searchVisible: true,
        data: input,
      };
      Object.assign(event, { requestId });
      state.events.push(event);
      return event;
    },
  };
  return { repository, state };
}

describe("event request decision", () => {
  it("creates exactly one event when approving a pending request", async () => {
    const { repository, state } = fixture();
    const result = await decideEventRequest(
      repository,
      { async upsert() {}, async remove() {} },
      { id: "admin-1" },
      "request-1",
      approval,
      "event-1",
      session,
    );
    assert.equal(result.status, "approved");
    assert.equal(state.events.length, 1);
  });

  it("rejects a second decision", async () => {
    const { repository } = fixture();
    await decideEventRequest(
      repository,
      { async upsert() {}, async remove() {} },
      { id: "admin-1" },
      "request-1",
      { decision: "reject", reason: "정보 부족" },
      "event-1",
      session,
    );
    await assert.rejects(
      decideEventRequest(
        repository,
        { async upsert() {}, async remove() {} },
        { id: "admin-1" },
        "request-1",
        approval,
        "event-2",
        session,
      ),
      EventRequestConflictError,
    );
  });

  it("upserts search after creating the approved event", async () => {
    const { repository } = fixture();
    const calls: string[] = [];
    await decideEventRequest(
      repository,
      {
        async upsert(content) {
          calls.push(content.id);
        },
        async remove() {},
      },
      { id: "admin-1" },
      "request-1",
      approval,
      "event-1",
      session,
    );
    assert.deepEqual(calls, ["event-1"]);
  });

  it("validates approval dates and URLs at the API boundary", () => {
    assert.throws(
      () =>
        parseDecideEventRequestInput({
          ...approval,
          event: {
            ...approval.event,
            startsAt: "invalid",
            applyUrl: "javascript:alert(1)",
          },
        }),
      EventRequestValidationError,
    );
  });

  it("compares approval dates as instants across timezone offsets", () => {
    assert.throws(
      () =>
        parseDecideEventRequestInput({
          ...approval,
          event: {
            ...approval.event,
            startsAt: "2026-08-01T01:00:00+00:00",
            endsAt: "2026-08-01T02:00:00+02:00",
          },
        }),
      EventRequestValidationError,
    );
  });

  it("rolls back the request decision when event creation fails", async () => {
    const { repository, state } = fixture(true);
    const unitOfWork = {
      async run<T>(work: (value: ClientSession) => Promise<T>) {
        const request = { ...state.request };
        try {
          return await work(session);
        } catch (error) {
          state.request = request;
          throw error;
        }
      },
    };
    await assert.rejects(() =>
      unitOfWork.run((value) =>
        decideEventRequest(
          repository,
          { async upsert() {}, async remove() {} },
          { id: "admin-1" },
          "request-1",
          approval,
          "event-1",
          value,
        ),
      ),
    );
    assert.equal(state.request.status, "pending");
  });
});
