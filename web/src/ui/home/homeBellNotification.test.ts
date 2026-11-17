import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { MemberSnapshot } from "@/domain/member/types";
import { useMemberStore } from "@/store/memberStore";

test("홈 종(알림) 클릭 시 memberStore의 모든 알림이 읽음 처리되고 DM 미읽음은 유지된다", () => {
  const initialSnapshot = {
    profile: { id: "member-1", isOwnProfile: true },
    account: {},
    careers: [],
    portfolios: [],
    notifications: [
      { id: "notif-1", unread: true, title: "새 댓글" },
      { id: "notif-2", unread: false, title: "이전 알림" },
    ],
    messages: [
      { id: "msg-1", recipientId: "member-1", read: false, senderId: "other" },
    ],
  } as unknown as MemberSnapshot;

  useMemberStore.setState({ snapshot: initialSnapshot });

  const beforeSnapshot = useMemberStore.getState().snapshot!;
  assert.equal(
    beforeSnapshot.notifications.some((n) => n.unread),
    true,
  );
  assert.equal(
    beforeSnapshot.messages.some((m) => !m.read),
    true,
  );

  useMemberStore.getState().markAllNotificationsRead();

  const afterSnapshot = useMemberStore.getState().snapshot!;
  assert.equal(
    afterSnapshot.notifications.some((n) => n.unread),
    false,
  );
  assert.equal(afterSnapshot.notifications[0].unread, false);
  assert.equal(
    afterSnapshot.messages.some((m) => !m.read),
    true,
  );
});

test("HeaderIconActions는 onNotificationClick 콜백을 지원한다", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/ui/shared/HeaderIconActions.tsx"),
    "utf-8",
  );
  assert.match(source, /onNotificationClick\?: \(\) => void;/);
  assert.match(source, /onClick=\{onNotificationClick\}/);
});

test("홈 메인 헤더는 종 버튼 클릭 시 알림 읽음 처리 및 store unread를 끈다", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/ui/home/HomeApp.tsx"),
    "utf-8",
  );
  assert.match(source, /onNotificationClick=\{handleNotificationClick\}/);
  assert.match(source, /markMemberNotificationsRead/);
  assert.match(source, /markAllNotificationsRead/);
});
