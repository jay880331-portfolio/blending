import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NotificationItem } from "../../domain/member/types";
import { notificationHref } from "./memberNotificationNavigation";

describe("notificationHref", () => {
  it("uses the stored notification href when present", () => {
    const notification: NotificationItem = {
      id: "message-1",
      kind: "message",
      title: "대화가 도착했습니다.",
      createdAgo: "방금 전",
      unread: true,
      href: "/mypage/messages?thread=user-1",
    };

    assert.equal(
      notificationHref(notification),
      "/mypage/messages?thread=user-1",
    );
  });

  it("normalizes message notification hrefs for the home notification screen", () => {
    const notification: NotificationItem = {
      id: "message-1",
      kind: "message",
      title: "대화가 도착했습니다.",
      createdAgo: "방금 전",
      unread: true,
      href: "/mypage/messages?thread=user-1",
    };

    assert.equal(
      notificationHref(notification, { messageBasePath: "/home/messages" }),
      "/home/messages?thread=user-1",
    );
  });

  it("falls back to the message inbox for older message notifications", () => {
    assert.equal(
      notificationHref({
        id: "message-legacy",
        kind: "message",
        title: "대화가 도착했습니다.",
        createdAgo: "방금 전",
        unread: true,
      }),
      "/mypage/messages",
    );
  });
});
