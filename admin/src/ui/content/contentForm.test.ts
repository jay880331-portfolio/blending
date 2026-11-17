import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseContentForm } from "./contentForm";

describe("parseContentForm", () => {
  it("creates an event and marks blank optional values for clearing", () => {
    const input = parseContentForm("community_event", {
      title: "커피 페어",
      category: "official",
      startsAt: "2026-07-10T10:00",
      endsAt: "",
      location: "코엑스",
      address: "서울시 강남구",
      imageUrl: "https://example.com/image.jpg",
      posterUrl: "https://example.com/poster.jpg",
      description: "행사 소개",
      applyUrl: "",
    });

    assert.deepEqual(input, {
      kind: "community_event",
      title: "커피 페어",
      category: "official",
      startsAt: "2026-07-10T10:00",
      endsAt: null,
      location: "코엑스",
      address: "서울시 강남구",
      imageUrl: "https://example.com/image.jpg",
      posterUrl: "https://example.com/poster.jpg",
      description: "행사 소개",
      applyUrl: null,
    });
  });

  it("normalizes promotion lists and nested specifications", () => {
    const input = parseContentForm("partner_promotion", {
      ownerId: "partner-1",
      title: "새 그라인더",
      category: "grinder",
      companyName: "블렌딩",
      authorName: "운영자",
      authorAvatarUrl: "",
      summary: "요약",
      description: "설명",
      thumbnailUrl: "https://example.com/thumb.jpg",
      imageUrls: "https://example.com/1.jpg\n\nhttps://example.com/2.jpg",
      brochureUrls: "https://example.com/brochure.pdf",
      attachments:
        "https://example.com/manual.pdf | 사용 설명서 | 1024 | application/pdf",
      tags: "그라인더, 신제품, ",
      externalUrl: "",
      specCompanyName: "블렌딩",
      specProductName: "G1",
      specCategoryLabel: "그라인더",
    });

    assert.equal(input.kind, "partner_promotion");
    if (input.kind !== "partner_promotion") return;
    assert.deepEqual(input.imageUrls, [
      "https://example.com/1.jpg",
      "https://example.com/2.jpg",
    ]);
    assert.deepEqual(input.tags, ["그라인더", "신제품"]);
    assert.deepEqual(input.attachments, [
      {
        url: "https://example.com/manual.pdf",
        name: "사용 설명서",
        size: 1024,
        contentType: "application/pdf",
      },
    ]);
    assert.deepEqual(input.specs, {
      companyName: "블렌딩",
      productName: "G1",
      categoryLabel: "그라인더",
    });
    assert.equal(input.authorAvatarUrl, null);
    assert.equal(input.externalUrl, null);
  });
});
