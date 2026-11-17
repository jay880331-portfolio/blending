import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClientSession } from "mongodb";
import {
  createGuideContent,
  listPublicFaqs,
  listPublicNotices,
  parseGuideContentListQuery,
  parseGuideContentInput,
} from "./guideContentUseCases";

const session = {} as ClientSession;

describe("guide content use cases", () => {
  it("returns only published non-deleted notices after their publish time", async () => {
    const repository = {
      listPublic: async () => [{ id: "published-now" }],
    };
    const result = await listPublicNotices(
      repository,
      new Date("2026-07-10T00:00:00Z"),
    );
    assert.deepEqual(
      result.map((item) => item.id),
      ["published-now"],
    );
  });

  it("orders public FAQs by sortOrder then id", async () => {
    const repository = {
      listPublic: async () => [
        { id: "faq-2", sortOrder: 1 },
        { id: "faq-1", sortOrder: 1 },
      ],
    };
    const result = await listPublicFaqs(repository, new Date());
    assert.deepEqual(
      result.map((item) => item.id),
      ["faq-1", "faq-2"],
    );
  });

  it("rejects a duplicate policy slug and version", async () => {
    const repository = {
      create: async () => {
        throw Object.assign(new Error("duplicate"), { code: 11000 });
      },
    };
    await assert.rejects(
      () =>
        createGuideContent(
          repository,
          "policy",
          "id",
          parseGuideContentInput("policy", {
            slug: "privacy",
            title: "개인정보 처리방침",
            body: "내용",
            version: 1,
            effectiveAt: "2026-07-10T00:00:00Z",
            status: "published",
            publishedAt: "2026-07-10T00:00:00Z",
          }),
          "admin",
          session,
        ),
      /이미 존재/,
    );
  });

  it("validates scheduled publishing and policy fields", () => {
    assert.throws(
      () =>
        parseGuideContentInput("notice", {
          title: "공지",
          body: "내용",
          status: "published",
        }),
      /발행 시각/,
    );
    assert.throws(
      () =>
        parseGuideContentInput("policy", {
          slug: "Bad Slug",
          title: "정책",
          body: "내용",
          version: 0,
          effectiveAt: "invalid",
          status: "draft",
        }),
      /slug|version|시각/,
    );
  });

  it("parses only explicit guide content list filters", () => {
    assert.deepEqual(
      parseGuideContentListQuery(
        new URLSearchParams(
          "q=%20notice%20&status=published&deleted=false&sort=publishedAt&direction=asc&page=2&pageSize=50",
        ),
      ),
      {
        q: "notice",
        status: "published",
        deleted: false,
        sort: "publishedAt",
        direction: "asc",
        page: 2,
        pageSize: 50,
      },
    );
  });

  it("rejects ambiguous guide content list filters", () => {
    for (const query of [
      "q=a",
      `q=${"a".repeat(101)}`,
      "direction=sideways",
      "deleted=1",
      "sort=title",
      "collection=users",
    ]) {
      assert.throws(
        () => parseGuideContentListQuery(new URLSearchParams(query)),
        /조회|검색|정렬|삭제/,
      );
    }
  });
});
