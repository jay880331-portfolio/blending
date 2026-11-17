import assert from "node:assert/strict";
import { it } from "node:test";
import { dispatchBlockedUser, listenForBlockedUser } from "./blockedUserEvent";
import {
  filterBlockedUserComments,
  filterBlockedUserItems,
  countComments,
} from "./blockedUserEvent";

it("notifies visible data owners when a user is blocked", () => {
  const target = new EventTarget();
  const blocked: string[] = [];
  const stop = listenForBlockedUser((userId) => blocked.push(userId), target);

  dispatchBlockedUser("blocked-user", target);
  stop();
  dispatchBlockedUser("other-user", target);

  assert.deepEqual(blocked, ["blocked-user"]);
});

it("filters blocked authors and nested comments immediately", () => {
  assert.deepEqual(
    filterBlockedUserItems(
      [{ id: "one", authorId: "blocked-user" }, { id: "two" }],
      "blocked-user",
    ),
    [{ id: "two" }],
  );
  type Comment = { id: string; authorId?: string; replies?: Comment[] };
  const comments: Comment[] = [
    {
      id: "one",
      replies: [{ id: "two", authorId: "blocked-user" }, { id: "three" }],
    },
  ];
  assert.deepEqual(filterBlockedUserComments(comments, "blocked-user"), [
    { id: "one", replies: [{ id: "three" }] },
  ]);
});

it("counts only the visible comments and replies", () => {
  assert.equal(
    countComments([
      { id: "one", replies: [{ id: "two" }, { id: "three" }] },
      { id: "four" },
    ]),
    4,
  );
});
