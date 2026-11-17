import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AdminContentDto } from "@blending/admin-contracts";
import {
  createContent,
  hideContent,
  parseAdminContentInput,
  restoreContent,
  updateContent,
  type AdminContentMutationRepository,
  type AdminContentSearchRepository,
} from "./contentUseCases";

const session = {} as never;
const activeReview: AdminContentDto = {
  id: "review-1",
  kind: "community_review",
  state: "active",
  ownerId: "user-1",
  title: "후기",
  views: 0,
  likes: 0,
  searchVisible: true,
  data: {
    kind: "community_review",
    ownerId: "user-1",
    eventId: "event-1",
    title: "후기",
    category: "official",
    authorName: "작성자",
    body: "내용",
    imageUrls: [],
    keywords: [],
  },
};

describe("admin content lifecycle", () => {
  it("synchronizes search in the same session for create and update", async () => {
    const searchEvents: string[] = [];
    const hidden = { ...activeReview, state: "hidden" as const };
    const repository: AdminContentMutationRepository = {
      findById: async () => activeReview,
      create: async () => activeReview,
      update: async () => ({ content: hidden, ownerClaimed: true }),
      changeState: async () => ({ content: hidden, changed: false }),
    };
    const search: AdminContentSearchRepository = {
      upsert: async (content, receivedSession) => {
        assert.equal(receivedSession, session);
        searchEvents.push(`upsert:${content.id}`);
      },
      remove: async (_kind, id, receivedSession) => {
        assert.equal(receivedSession, session);
        searchEvents.push(`remove:${id}`);
      },
    };

    await createContent(
      repository,
      search,
      activeReview.kind,
      activeReview.id,
      activeReview.data,
      session,
    );
    const updated = await updateContent(
      repository,
      search,
      hidden.kind,
      hidden.id,
      hidden.data,
      session,
    );
    assert.equal(updated.ownerClaimed, true);
    assert.deepEqual(searchEvents, ["upsert:review-1", "remove:review-1"]);
  });

  it("validates by kind and strips immutable fields", () => {
    const input = parseAdminContentInput("community_review", {
      kind: "community_review",
      id: "forged",
      ownerId: "user-1",
      eventId: "event-1",
      title: "후기",
      category: "official",
      authorName: "작성자",
      body: "내용",
      imageUrls: [],
      keywords: [],
      likes: 999,
      moderationStatus: "deleted",
    });
    assert.equal(input.kind, "community_review");
    assert.equal("id" in input, false);
    assert.equal("likes" in input, false);
    assert.equal("moderationStatus" in input, false);
    assert.throws(
      () =>
        parseAdminContentInput("community_review", {
          ...input,
          ownerId: "",
        }),
      /ownerId/,
    );
    assert.throws(
      () => parseAdminContentInput("partner_banner", input),
      /kind/,
    );
  });

  it("distinguishes omitted optional values from explicit clears", () => {
    const base = {
      kind: "community_event" as const,
      title: "이벤트",
      category: "official" as const,
      startsAt: "2026-07-11T10:00:00.000Z",
      location: "서울",
      address: "주소",
      imageUrl: "https://example.com/image.jpg",
      posterUrl: "https://example.com/poster.jpg",
      description: "설명",
    };
    const omitted = parseAdminContentInput("community_event", base);
    const cleared = parseAdminContentInput("community_event", {
      ...base,
      endsAt: null,
      applyUrl: "",
    });
    assert.equal("endsAt" in omitted, false);
    assert.equal("applyUrl" in omitted, false);
    if (cleared.kind !== "community_event") assert.fail("wrong kind");
    assert.equal(cleared.endsAt, null);
    assert.equal(cleared.applyUrl, null);
  });

  it("validates banner ordering and active range", () => {
    const banner = {
      kind: "partner_banner" as const,
      title: "배너",
      subtitle: "설명",
      imageUrl: "https://example.com/banner.jpg",
      href: "/partner",
      sortOrder: 1,
      activeFrom: "2026-08-01T00:00:00.000Z",
      activeTo: "2026-07-01T00:00:00.000Z",
    };
    assert.throws(() => parseAdminContentInput("partner_banner", banner));
    assert.throws(() =>
      parseAdminContentInput("partner_banner", {
        ...banner,
        activeFrom: "2026-07-01T00:00:00.000Z",
        sortOrder: -1,
      }),
    );
  });

  it("compares banner dates as instants across timezone offsets", () => {
    assert.throws(() =>
      parseAdminContentInput("partner_banner", {
        kind: "partner_banner",
        title: "배너",
        subtitle: "설명",
        imageUrl: "https://example.com/banner.jpg",
        href: "/partner",
        sortOrder: 1,
        activeFrom: "2026-08-01T01:00:00+00:00",
        activeTo: "2026-08-01T02:00:00+02:00",
      }),
    );
  });

  it("removes search documents on hide and recreates them on restore", async () => {
    let content = activeReview;
    const searchDocuments = new Map([[activeReview.id, activeReview]]);
    const repository: AdminContentMutationRepository = {
      create: async () => activeReview,
      update: async () => ({ content: activeReview, ownerClaimed: false }),
      async findById() {
        return content;
      },
      async changeState(_kind, _id, state, reason) {
        content = { ...content, state, moderationReason: reason };
        return { content, changed: true };
      },
    };
    const search: AdminContentSearchRepository = {
      async upsert(value) {
        searchDocuments.set(value.id, value);
      },
      async remove(_kind, id) {
        searchDocuments.delete(id);
      },
    };

    await hideContent(
      repository,
      search,
      "community_review",
      "review-1",
      "신고 확인",
      session,
    );
    assert.equal(searchDocuments.get("review-1"), undefined);
    await restoreContent(
      repository,
      search,
      "community_review",
      "review-1",
      "오조치 복구",
      session,
    );
    assert.equal(searchDocuments.get("review-1")?.state, "active");
  });

  it("requires a reason before changing lifecycle state", async () => {
    const repository = {
      create: async () => activeReview,
      update: async () => ({ content: activeReview, ownerClaimed: false }),
      findById: async () => activeReview,
      changeState: async () => ({ content: activeReview, changed: false }),
    } satisfies AdminContentMutationRepository;
    const search = {
      upsert: async () => undefined,
      remove: async () => undefined,
    } satisfies AdminContentSearchRepository;

    await assert.rejects(
      hideContent(
        repository,
        search,
        "community_review",
        "review-1",
        "  ",
        session,
      ),
      /사유/,
    );
  });

  it("does not rewrite search for an idempotent lifecycle request", async () => {
    let removed = 0;
    const hidden = { ...activeReview, state: "hidden" as const };
    const result = await hideContent(
      {
        create: async () => hidden,
        update: async () => ({ content: hidden, ownerClaimed: false }),
        findById: async () => hidden,
        changeState: async () => ({ content: hidden, changed: false }),
      },
      {
        upsert: async () => undefined,
        remove: async () => {
          removed += 1;
        },
      },
      "community_review",
      "review-1",
      "같은 요청",
      session,
    );
    assert.equal(result.changed, false);
    assert.equal(removed, 0);
  });
});
