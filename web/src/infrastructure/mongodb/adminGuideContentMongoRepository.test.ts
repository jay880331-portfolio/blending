import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  guideContentListFilter,
  guideContentUpdateFilter,
  publicGuideContentFilter,
  sortPublicFaqs,
} from "./adminGuideContentMongoRepository";

describe("admin guide content Mongo repository", () => {
  it("builds the public publish-time and deletion boundary", () => {
    const now = new Date("2026-07-10T00:00:00Z");
    assert.deepEqual(publicGuideContentFilter(now), {
      status: "published",
      deletedAt: { $exists: false },
      publishedAt: { $lte: now.toISOString() },
    });
  });

  it("filters admin lists by status and deletion state", () => {
    assert.deepEqual(
      guideContentListFilter({ status: "draft", deleted: true }),
      {
        status: "draft",
        deletedAt: { $exists: true },
      },
    );
  });

  it("orders FAQs by sortOrder then id", () => {
    assert.deepEqual(
      sortPublicFaqs([
        { id: "faq-2", sortOrder: 1 },
        { id: "faq-3", sortOrder: 2 },
        { id: "faq-1", sortOrder: 1 },
      ]).map((item) => item.id),
      ["faq-1", "faq-2", "faq-3"],
    );
  });

  it("updates only non-deleted content", () => {
    assert.deepEqual(guideContentUpdateFilter("notice-1"), {
      id: "notice-1",
      deletedAt: { $exists: false },
    });
  });
});
