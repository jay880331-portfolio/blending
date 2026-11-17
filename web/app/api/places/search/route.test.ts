import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "./route";

test("지역 검색은 NAVER API HUB 주소와 인증 헤더를 사용한다", async () => {
  const originalFetch = globalThis.fetch;
  const originalClientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const originalClientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;
  const requests: Array<{ url: string; headers: Headers }> = [];

  process.env.NAVER_SEARCH_CLIENT_ID = "api-hub-client-id";
  process.env.NAVER_SEARCH_CLIENT_SECRET = "api-hub-client-secret";
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      headers: new Headers(init?.headers),
    });
    return Response.json({ items: [] });
  };

  try {
    await GET(
      new Request(
        "https://blending.ridge-it.site/api/places/search?query=수원메쎄",
      ),
    );

    const request = requests.find(({ url }) =>
      url.includes("/search/v1/local"),
    );
    assert.ok(request, "NAVER API HUB 지역 검색 요청이 필요합니다.");
    assert.equal(
      request.url,
      "https://naverapihub.apigw.ntruss.com/search/v1/local?query=%EC%88%98%EC%9B%90%EB%A9%94%EC%8E%84&display=5",
    );
    assert.equal(
      request.headers.get("X-NCP-APIGW-API-KEY-ID"),
      "api-hub-client-id",
    );
    assert.equal(
      request.headers.get("X-NCP-APIGW-API-KEY"),
      "api-hub-client-secret",
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalClientId === undefined) {
      delete process.env.NAVER_SEARCH_CLIENT_ID;
    } else {
      process.env.NAVER_SEARCH_CLIENT_ID = originalClientId;
    }
    if (originalClientSecret === undefined) {
      delete process.env.NAVER_SEARCH_CLIENT_SECRET;
    } else {
      process.env.NAVER_SEARCH_CLIENT_SECRET = originalClientSecret;
    }
  }
});
