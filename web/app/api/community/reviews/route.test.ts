import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST } from "./route";

test("후기 생성 route는 로그인하지 않은 요청에 401을 반환한다", async () => {
  const request = new NextRequest("http://localhost/api/community/reviews", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "후기 제목",
      body: "후기 내용",
    }),
  });

  const response = await POST(request);
  assert.equal(response.status, 401);

  const data = (await response.json()) as { message: string };
  assert.equal(data.message, "로그인이 필요합니다.");
});
