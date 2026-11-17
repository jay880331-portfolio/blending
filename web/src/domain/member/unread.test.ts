import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasUnreadMemberUpdates } from "./unread";

describe("hasUnreadMemberUpdates", () => {
  it("turns on the header red dot for unread direct messages", () => {
    assert.equal(
      hasUnreadMemberUpdates({
        profile: { id: "me" },
        notifications: [],
        messages: [
          {
            id: "message-1",
            senderId: "barista-1",
            senderName: "바리스타",
            recipientId: "me",
            recipientName: "나",
            body: "문의드립니다.",
            read: false,
            createdAt: "2026.05.30 15:00",
          },
        ],
      }),
      true,
    );
  });

  it("keeps the red dot off when notifications and messages are read", () => {
    assert.equal(
      hasUnreadMemberUpdates({
        profile: { id: "me" },
        notifications: [
          {
            id: "notice-1",
            kind: "notice",
            title: "공지",
            createdAgo: "1일 전",
            unread: false,
          },
        ],
        messages: [],
      }),
      false,
    );
  });

  it("ignores unread direct messages sent by the current member", () => {
    assert.equal(
      hasUnreadMemberUpdates({
        profile: { id: "me" },
        notifications: [],
        messages: [
          {
            id: "message-1",
            senderId: "me",
            senderName: "나",
            recipientId: "barista-1",
            recipientName: "바리스타",
            body: "문의드립니다.",
            read: false,
            createdAt: "2026.05.30 15:00",
          },
        ],
      }),
      false,
    );
  });
});
