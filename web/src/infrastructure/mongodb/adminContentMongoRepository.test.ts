import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AdminContentInput } from "@blending/admin-contracts";
import { ObjectId } from "mongodb";
import {
  assertBannerSlotAvailable,
  bannerSlotCollisionFilter,
  buildContentMongoUpdate,
  contentStateFilter,
  contentUpdateFields,
  contentUnsetFields,
  isAdminContentKind,
  isPublicContent,
  publicContentFilter,
  reactionDeleteFilter,
  resolveContentOwnerUpdate,
  toAdminContentDto,
} from "./adminContentMongoRepository";

const activeReview = {
  kind: "community_review",
  ownerId: "user-1",
  eventId: "event-1",
  title: "후기",
  category: "official",
  authorName: "작성자",
  body: "내용",
  imageUrls: [],
  keywords: [],
} satisfies AdminContentInput;
const activeBTalk = {
  kind: "community_b_talk",
  ownerId: "user-1",
  title: "레시피",
  roast: "medium",
  authorName: "작성자",
  processImages: [],
  bean: { origin: "원산지", process: "가공", roastPoint: "중배전" },
  extraction: { dosing: "20g", yield: "40g", time: "30s", temp: "93c" },
  note: "노트",
} satisfies AdminContentInput;
const activeQa = {
  kind: "community_qa",
  ownerId: "user-1",
  title: "질문",
  authorName: "작성자",
  body: "내용",
  imageUrls: [],
} satisfies AdminContentInput;
const activePromotion = {
  kind: "partner_promotion",
  ownerId: "user-1",
  title: "홍보",
  category: "grinder",
  companyName: "회사",
  authorName: "작성자",
  summary: "요약",
  description: "설명",
  thumbnailUrl: "https://example.com/thumb.jpg",
  imageUrls: [],
  brochureUrls: [],
  tags: [],
  specs: {
    companyName: "회사",
    productName: "제품",
    categoryLabel: "그라인더",
  },
} satisfies AdminContentInput;
const activePartnerReview = {
  kind: "partner_review",
  ownerId: "user-1",
  promotionId: "promotion-1",
  productName: "제품",
  category: "grinder",
  brand: "브랜드",
  modelName: "모델",
  features: "특징",
  reviewerName: "리뷰어",
  summary: "요약",
  body: "내용",
  imageUrls: [],
  tags: [],
  majorPros: [],
  baristaTip: "팁",
} satisfies AdminContentInput;

describe("content lifecycle filters", () => {
  it("treats legacy content as active and excludes hidden or deleted content", () => {
    assert.equal(isPublicContent({}), true);
    assert.equal(isPublicContent({ moderationStatus: "active" }), true);
    assert.equal(isPublicContent({ moderationStatus: "hidden" }), false);
    assert.equal(isPublicContent({ moderationStatus: "deleted" }), false);
    assert.deepEqual(contentStateFilter("active"), publicContentFilter);
    assert.deepEqual(contentStateFilter("hidden"), {
      moderationStatus: "hidden",
    });
  });

  it("rejects collection names outside the content kind allowlist", () => {
    assert.equal(isAdminContentKind("community_review"), true);
    assert.equal(isAdminContentKind("users"), false);
  });

  it("maps an explicit safe DTO and ignores immutable or secret fields", () => {
    const dto = toAdminContentDto("community_qa", {
      _id: "internal",
      id: "qa-1",
      ownerId: "user-1",
      title: "질문",
      authorName: "작성자",
      createdAt: "2026-07-10T00:00:00.000Z",
      createdAgo: "방금 전",
      commentCount: 0,
      imageUrls: [],
      body: "내용",
      likes: 2,
      liked: false,
      viewCount: 3,
      comments: [],
      passwordHash: "secret",
      identityKey: "visitor:secret",
    });
    assert.equal(dto.ownerId, "user-1");
    assert.equal(dto.likes, 2);
    assert.equal(JSON.stringify(dto).includes("passwordHash"), false);
    assert.equal(JSON.stringify(dto).includes("identityKey"), false);
    assert.equal(JSON.stringify(dto).includes("_id"), false);
  });

  it("only produces mutable content fields for updates", () => {
    const fields = contentUpdateFields({
      kind: "partner_banner",
      title: "배너",
      subtitle: "설명",
      imageUrl: "https://example.com/banner.jpg",
      href: "/partner",
      sortOrder: 0,
      activeFrom: "2026-07-01T00:00:00.000Z",
      activeTo: "2026-08-01T00:00:00.000Z",
    });
    assert.deepEqual(Object.keys(fields).sort(), [
      "activeFrom",
      "activeTo",
      "href",
      "imageUrl",
      "sortOrder",
      "subtitle",
      "title",
    ]);
  });

  it("unsets optional values only when explicitly cleared", () => {
    const fields = contentUnsetFields({
      kind: "community_event",
      title: "이벤트",
      category: "official",
      startsAt: "2026-07-11T10:00:00.000Z",
      endsAt: null,
      location: "서울",
      address: "주소",
      imageUrl: "https://example.com/image.jpg",
      posterUrl: "https://example.com/poster.jpg",
      description: "설명",
      applyUrl: null,
    });
    assert.deepEqual(fields, { endsAt: "", applyUrl: "" });
    assert.deepEqual(
      contentUnsetFields({
        ...activeBTalk,
        coverUrl: null,
      }),
      { coverUrl: "" },
    );
    assert.deepEqual(
      contentUnsetFields({
        ...activePromotion,
        authorAvatarUrl: null,
        attachments: null,
        externalUrl: null,
      }),
      { authorAvatarUrl: "", attachments: "", externalUrl: "" },
    );
    assert.deepEqual(
      contentUnsetFields({
        ...activePartnerReview,
        attachments: null,
        relatedUrl: null,
      }),
      { attachments: "", relatedUrl: "" },
    );
    assert.deepEqual(
      contentUnsetFields({ ...activeQa, authorAvatarUrl: null }),
      { authorAvatarUrl: "" },
    );

    const reviewFields = contentUpdateFields({
      ...activeReview,
      authorAvatarUrl: null,
    });
    const partnerReviewFields = contentUpdateFields({
      ...activePartnerReview,
      reviewerAvatarUrl: null,
      reviewerResumeUrl: null,
    });
    assert.equal("avatarUrl" in reviewFields.author, false);
    assert.equal("avatarUrl" in partnerReviewFields.reviewer, false);
    assert.equal("resumeUrl" in partnerReviewFields.reviewer, false);
  });

  it("never composes the same path into both set and unset", () => {
    const update = buildContentMongoUpdate(
      {
        kind: "community_event",
        title: "이벤트",
        category: "official",
        startsAt: "2026-07-11T10:00:00.000Z",
        endsAt: "2026-07-11T12:00:00.000Z",
        location: "서울",
        address: "주소",
        imageUrl: "https://example.com/image.jpg",
        posterUrl: "https://example.com/poster.jpg",
        description: "설명",
        applyUrl: "https://example.com/apply",
      },
      {
        kind: "community_event",
        title: "이벤트",
        category: "official",
        startsAt: "2026-07-11T10:00:00.000Z",
        endsAt: null,
        location: "서울",
        address: "주소",
        imageUrl: "https://example.com/image.jpg",
        posterUrl: "https://example.com/poster.jpg",
        description: "설명",
        applyUrl: null,
      },
      "2026-07-11T09:00:00.000Z",
    );
    const setPaths = new Set(Object.keys(update.$set ?? {}));
    const unsetPaths = Object.keys(update.$unset ?? {});
    assert.equal(
      unsetPaths.some((path) => setPaths.has(path)),
      false,
    );
    assert.deepEqual(unsetPaths.sort(), ["applyUrl", "endsAt"]);
  });

  it("allows one atomic owner claim and rejects later mismatches", () => {
    assert.deepEqual(resolveContentOwnerUpdate(undefined, "user-1"), {
      claim: true,
      filter: { $or: [{ ownerId: { $exists: false } }, { ownerId: "" }] },
    });
    assert.deepEqual(resolveContentOwnerUpdate("user-1", "user-1"), {
      claim: false,
      filter: { ownerId: "user-1" },
    });
    assert.throws(
      () => resolveContentOwnerUpdate("user-2", "user-1"),
      /소유자/,
    );
  });

  it("scopes reaction deletion to the content kind and id", () => {
    const reactionId = "507f1f77bcf86cd799439011";
    assert.deepEqual(
      reactionDeleteFilter("community_review", "review-1", reactionId),
      {
        _id: new ObjectId(reactionId),
        targetType: "community_review",
        targetId: "review-1",
      },
    );
    assert.throws(
      () => reactionDeleteFilter("community_review", "review-1", "bad"),
      /반응 ID/,
    );
  });

  it("detects overlapping banner slots but excludes the edited banner", () => {
    const filter = bannerSlotCollisionFilter(
      {
        kind: "partner_banner",
        title: "배너",
        subtitle: "설명",
        imageUrl: "https://example.com/banner.jpg",
        href: "/partner",
        sortOrder: 2,
        activeFrom: "2026-07-01T00:00:00.000Z",
        activeTo: "2026-08-01T00:00:00.000Z",
      },
      "banner-1",
    );
    assert.deepEqual(filter.id, { $ne: "banner-1" });
    assert.deepEqual(filter.activeFrom, { $lt: "2026-08-01T00:00:00.000Z" });
    assert.deepEqual(filter.activeTo, { $gt: "2026-07-01T00:00:00.000Z" });
  });

  it("locks the sort order before checking banner overlap", async () => {
    const calls: string[] = [];
    const db = {
      collection(name: string) {
        if (name === "app_configs")
          return {
            async updateOne() {
              calls.push("lock");
            },
          };
        return {
          async findOne() {
            calls.push("check");
            return null;
          },
        };
      },
    };
    await assertBannerSlotAvailable(
      db as never,
      {
        kind: "partner_banner",
        title: "배너",
        subtitle: "설명",
        imageUrl: "https://example.com/banner.jpg",
        href: "/partner",
        sortOrder: 2,
        activeFrom: "2026-07-01T00:00:00.000Z",
        activeTo: "2026-08-01T00:00:00.000Z",
      },
      {} as never,
    );
    calls.push("write");
    assert.deepEqual(calls, ["lock", "check", "write"]);
  });

  it("allows only one concurrent write for an overlapping banner slot", async () => {
    const input = {
      kind: "partner_banner" as const,
      title: "배너",
      subtitle: "설명",
      imageUrl: "https://example.com/banner.jpg",
      href: "/partner",
      sortOrder: 2,
      activeFrom: "2026-07-01T00:00:00.000Z",
      activeTo: "2026-08-01T00:00:00.000Z",
    };
    const slots: (typeof input)[] = [];
    const releases = new Map<object, () => void>();
    let lock = Promise.resolve();
    const db = {
      collection(name: string) {
        if (name === "app_configs")
          return {
            async updateOne(
              _filter: unknown,
              _update: unknown,
              options: { session: object },
            ) {
              const previous = lock;
              let release!: () => void;
              lock = new Promise<void>((resolve) => {
                release = resolve;
              });
              await previous;
              releases.set(options.session, release);
            },
          };
        return {
          async findOne() {
            return slots.find(
              (slot) =>
                slot.sortOrder === input.sortOrder &&
                slot.activeFrom < input.activeTo &&
                slot.activeTo > input.activeFrom,
            );
          },
        };
      },
    };
    async function write(session: object) {
      try {
        await assertBannerSlotAvailable(db as never, input, session as never);
        slots.push(input);
      } finally {
        releases.get(session)?.();
      }
    }
    const results = await Promise.allSettled([write({}), write({})]);
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      results.filter((result) => result.status === "rejected").length,
      1,
    );
    assert.equal(slots.length, 1);
  });
});
