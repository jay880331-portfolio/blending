import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "./route";

test("Daily Note 댓글 좋아요는 로그인을 요구한다", async () => {
  const response = await POST(
    new NextRequest(
      "http://localhost/api/community/daily-notes/daily-note-1/comments/comment-1/like",
      { method: "POST", body: JSON.stringify({ liked: true }) },
    ),
    {
      params: Promise.resolve({
        id: "daily-note-1",
        commentId: "comment-1",
      }),
    },
  );

  assert.equal(response.status, 401);
});
