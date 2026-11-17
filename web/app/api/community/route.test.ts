import assert from "node:assert/strict";
import { test } from "node:test";
import type { QaComment } from "@/domain/community/types";
import { markCommentOwnership } from "./commentOwnership";

test("public community API tombstones deleted reply body and author fields", () => {
  const comments = markCommentOwnership(
    [
      {
        id: "c1",
        body: "visible",
        authorName: "A",
        createdAgo: "now",
        likes: 0,
        replies: [
          {
            id: "r1",
            body: "secret",
            authorName: "B",
            ownerId: "u2",
            createdAgo: "now",
            likes: 0,
            isDeleted: true,
          } as QaComment & { ownerId: string },
        ],
      },
    ],
    null,
    false,
    new Set(),
    { byOwnerId: new Map(), byName: new Map() },
  );
  assert.equal(comments[0]?.replies?.[0]?.body, "삭제된 댓글입니다.");
  assert.equal(comments[0]?.replies?.[0]?.authorName, "댓글 작성자");
  assert.equal(comments[0]?.replies?.[0]?.authorAvatarUrl, undefined);
  assert.equal(comments[0]?.replies?.[0]?.authorId, undefined);
  assert.equal("ownerId" in (comments[0]?.replies?.[0] ?? {}), false);
});

test("admin can manage another user's comment without owning it", () => {
  const comments = markCommentOwnership(
    [
      {
        id: "c1",
        body: "visible",
        authorName: "A",
        ownerId: "u2",
        createdAgo: "now",
        likes: 0,
      } as QaComment & { ownerId: string },
    ],
    null,
    true,
    new Set(["u2"]),
    { byOwnerId: new Map(), byName: new Map() },
  );

  assert.equal(comments[0]?.isOwner, false);
  assert.equal(comments[0]?.canManage, true);
});
