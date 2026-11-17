import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SearchDocument } from "@/domain/search/types";
import {
  filterExistingSearchDocuments,
  isSearchableAdminContentKind,
  searchSourceFilter,
  staleSearchDocumentIds,
  toTextSearchQuery,
} from "./searchMongoRepository";

function searchDocument(
  sourceType: SearchDocument["sourceType"],
  sourceId: string,
): SearchDocument {
  return {
    id: `${sourceType}:${sourceId}`,
    sourceType,
    sourceId,
    title: sourceId,
    body: sourceId,
    keywords: [],
    category: sourceType,
    href: `/${sourceType}/${sourceId}`,
    visibility: "public",
    createdAt: sourceId,
    updatedAt: sourceId,
  };
}

describe("filterExistingSearchDocuments", () => {
  it("removes search documents whose source content was deleted", () => {
    const activeReview = searchDocument("community_review", "active-review");
    const deletedReview = searchDocument("community_review", "deleted-review");
    const qaPost = searchDocument("community_qa", "active-qa");

    assert.deepEqual(
      filterExistingSearchDocuments([activeReview, deletedReview, qaPost], {
        community_review: new Set(["active-review"]),
        community_qa: new Set(["active-qa"]),
      }),
      [activeReview, qaPost],
    );
  });

  it("requires source content to remain publicly visible", () => {
    assert.deepEqual(searchSourceFilter(["active-review"]), {
      $and: [
        { id: { $in: ["active-review"] } },
        {
          $or: [
            { moderationStatus: "active" },
            { moderationStatus: { $exists: false } },
          ],
        },
      ],
    });
  });

  it("does not mark a viewer-blocked document stale for global deletion", () => {
    const review = searchDocument("community_review", "blocked-review");
    const actualSourceIds = { community_review: new Set(["blocked-review"]) };
    const viewerVisibleSourceIds = { community_review: new Set<string>() };
    assert.deepEqual(staleSearchDocumentIds([review], actualSourceIds), []);
    assert.deepEqual(
      filterExistingSearchDocuments([review], viewerVisibleSourceIds),
      [],
    );
  });

  it("does not create public search documents for banners", () => {
    assert.equal(isSearchableAdminContentKind("partner_banner"), false);
    assert.equal(isSearchableAdminContentKind("partner_review"), true);
  });
});

describe("toTextSearchQuery", () => {
  it("removes text search operators from user input", () => {
    assert.equal(toTextSearchQuery('  "라떼"   -원두  a  '), "라떼 원두");
  });
});
