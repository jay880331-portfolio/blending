import assert from "node:assert/strict";
import { it } from "node:test";
import { isBlockedMessage } from "./memberStore";

it("removes both incoming and outgoing messages for a blocked counterpart", () => {
  assert.equal(
    isBlockedMessage(
      {
        id: "incoming",
        senderId: "blocked-user",
        senderName: "상대",
        recipientId: "me",
        recipientName: "나",
        body: "메시지",
        read: false,
        createdAt: "2026-08-01T00:00:00.000Z",
      },
      "blocked-user",
    ),
    true,
  );
  assert.equal(
    isBlockedMessage(
      {
        id: "outgoing",
        senderId: "me",
        senderName: "나",
        recipientId: "blocked-user",
        recipientName: "상대",
        body: "메시지",
        read: true,
        createdAt: "2026-08-01T00:00:00.000Z",
      },
      "blocked-user",
    ),
    true,
  );
});
