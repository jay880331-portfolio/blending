import assert from "node:assert/strict";
import test from "node:test";
import { fetchPublicFaqs, fetchPublicNotices } from "./guideContentApi";

test("loads public notices from the content endpoint", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.equal(input, "/api/content/notices");
    return Response.json([
      {
        id: "notice-1",
        publishedAt: "2026-07-11T00:00:00.000Z",
        data: { title: "공지", body: "본문" },
      },
    ]);
  };

  try {
    assert.equal((await fetchPublicNotices())[0]?.title, "공지");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("surfaces a useful error when public FAQ loading fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 503 });

  try {
    await assert.rejects(fetchPublicFaqs(), /FAQ를 불러오지 못했습니다/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
