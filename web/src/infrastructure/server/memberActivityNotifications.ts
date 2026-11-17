import { after } from "next/server";
import type {
  NotificationItem,
  NotificationSettingKey,
} from "@/domain/member/types";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { activeAccountFilter } from "@/infrastructure/server/accountStatus";
import { createdAgoNow, createId } from "@/infrastructure/server/content";
import {
  isNotificationEnabled,
  sendPushNotification,
  sendPushNotificationIfEnabled,
  type PushNotificationPayload,
} from "@/infrastructure/server/pushNotifications";

type MemberActivityNotificationInput = {
  recipientId: string;
  actorId?: string;
  settingKey?: NotificationSettingKey;
  kind: NotificationItem["kind"];
  title: string;
  href: string;
  pushTitle: string;
  pushBody: string;
  notificationId?: string;
};

export function scheduleMemberActivityNotification(
  input: MemberActivityNotificationInput,
) {
  const task = () => notifyMemberActivity(input);
  try {
    after(task);
  } catch {
    void task();
  }
}

export async function notifyMemberActivity(
  input: MemberActivityNotificationInput,
) {
  if (input.actorId && input.actorId === input.recipientId) return;
  if (
    input.settingKey &&
    !(await isNotificationEnabled(input.recipientId, input.settingKey))
  )
    return;

  const now = new Date();
  const notification: NotificationItem & {
    ownerId: string;
    _createdAt: Date;
  } = {
    ownerId: input.recipientId,
    _createdAt: now,
    id: input.notificationId ?? createId(input.kind),
    kind: input.kind,
    title: input.title,
    createdAgo: createdAgoNow(),
    unread: true,
    href: input.href,
  };

  const db = await getMongoDb();
  const result = await db
    .collection("member_notifications")
    .updateOne(
      { ownerId: notification.ownerId, id: notification.id },
      { $setOnInsert: notification },
      { upsert: true },
    );
  if (!result.upsertedId) return;

  const payload: PushNotificationPayload = {
    title: input.pushTitle,
    body: input.pushBody,
    data: { href: input.href },
  };
  if (input.settingKey) {
    await sendPushNotificationIfEnabled(
      input.recipientId,
      input.settingKey,
      payload,
    );
    return;
  }
  await sendPushNotification(input.recipientId, payload);
}

export function schedulePublishedNoticeFanout(input: {
  noticeId: string;
  title: string;
}) {
  const task = () => fanOutPublishedNotice(input);
  try {
    after(task);
  } catch {
    void task();
  }
}

export function shouldFanOutPublishedNotice(
  kind: string,
  nextStatus: string,
  previousStatus?: string,
) {
  return (
    kind === "notice" &&
    nextStatus === "published" &&
    previousStatus !== "published"
  );
}

export async function fanOutPublishedNotice(input: {
  noticeId: string;
  title: string;
}) {
  const db = await getMongoDb();
  const recipients = await db
    .collection<{ id: string }>("users")
    .find(activeAccountFilter())
    .project<{ id: string }>({ id: 1, _id: 0 })
    .toArray();

  const href = "/mypage/notices";
  const title = `[공지] ${input.title}`;
  await Promise.all(
    recipients.map((recipient) =>
      notifyMemberActivity({
        recipientId: recipient.id,
        kind: "notice",
        title,
        href,
        pushTitle: "새 공지",
        pushBody: title,
        notificationId: `notice-${input.noticeId}`,
      }),
    ),
  );
}
