import assert from "node:assert/strict";
import { test } from "node:test";
import {
  supportsCommentReplies,
  visualViewportKeyboardOffset,
} from "./CommentThread";

test("답글 핸들러가 없으면 답글 기능을 노출하지 않는다", () => {
  assert.equal(supportsCommentReplies(), false);
  assert.equal(supportsCommentReplies({ onReply: () => undefined }), false);
  assert.equal(
    supportsCommentReplies({
      onReply: () => undefined,
      requestReply: async () => ({
        id: "reply-1",
        authorName: "답글 작성자",
        createdAgo: "방금 전",
        body: "답글",
        likes: 0,
      }),
    }),
    true,
  );
});

test("댓글 입력창은 visual viewport 기준 키보드 오프셋만 적용한다", () => {
  assert.equal(visualViewportKeyboardOffset(844, 844, 0), 0);
  assert.equal(visualViewportKeyboardOffset(844, 500, 0), 344);
  assert.equal(visualViewportKeyboardOffset(844, 500, 20), 324);
});
