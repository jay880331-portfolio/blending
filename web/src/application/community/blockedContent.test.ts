import assert from "node:assert/strict";
import test from "node:test";
import {
  blockedOwnerFilter,
  countVisibleComments,
  filterBlockedComments,
  filterBlockedOwners,
} from "./blockedContent";

type Comment = { id: string; ownerId: string; replies?: Comment[] };

test("excludes blocked authors and their nested comments", () => {
  assert.deepEqual(blockedOwnerFilter(["u2"]), { ownerId: { $nin: ["u2"] } });
  assert.deepEqual(
    filterBlockedOwners(
      [
        { id: "a", ownerId: "u1" },
        { id: "b", ownerId: "u2" },
      ],
      ["u2"],
    ),
    [{ id: "a", ownerId: "u1" }],
  );
  const comments = filterBlockedComments<Comment>(
    [
      {
        id: "a",
        ownerId: "u1",
        replies: [
          { id: "r1", ownerId: "u2" },
          { id: "r2", ownerId: "u3" },
        ],
      },
      { id: "b", ownerId: "u2" },
    ],
    ["u2"],
  );
  assert.deepEqual(comments, [
    { id: "a", ownerId: "u1", replies: [{ id: "r2", ownerId: "u3" }] },
  ]);
  assert.equal(countVisibleComments<Comment>(comments), 2);
});
