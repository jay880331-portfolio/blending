import assert from "node:assert/strict";
import test from "node:test";
import {
  filterBlockedMessages,
  filterBlockedUserItems,
  interestSourceFilter,
} from "./memberMongoRepository";

test("member snapshot filters blocked references again after refetch", () => {
  const blocked = ["user-2"];
  const messages = [
    { id: "m1", senderId: "user-1", recipientId: "user-2" },
    { id: "m2", senderId: "user-3", recipientId: "user-1" },
  ];
  assert.deepEqual(filterBlockedMessages(messages, "user-1", blocked), [
    messages[1],
  ]);
  assert.deepEqual(
    filterBlockedUserItems([{ id: "user-2" }, { id: "user-3" }], blocked),
    [{ id: "user-3" }],
  );
});

test("interests exclude blocked owners for every liked public content type", () => {
  const contentTypes = [
    "community_b_talk",
    "community_qa",
    "community_review",
    "partner_promotion",
    "partner_review",
    "community_daily_note",
  ];

  for (const contentType of contentTypes) {
    const filter = interestSourceFilter([`${contentType}-1`], ["user-2"]);
    assert.deepEqual(filter.$and[2], { ownerId: { $nin: ["user-2"] } });
  }
});
