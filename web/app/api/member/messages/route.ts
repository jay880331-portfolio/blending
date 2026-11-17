import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  defaultNotificationSettings,
  type DirectChatRoomSetting,
  type DirectMessage,
  type MemberProfile,
  type NotificationItem,
  type NotificationSettings,
} from "@/domain/member/types";
import { getMongoDb, toDomain } from "@/infrastructure/mongodb/client";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import {
  getCurrentUser,
  type UserDocument,
} from "@/infrastructure/server/auth";
import {
  canReceiveDirectMessage,
  canSendMapMessage,
} from "@/infrastructure/server/authRole";
import { jsonError, readJson } from "@/infrastructure/server/http";
import { sendPushNotification } from "@/infrastructure/server/pushNotifications";

type CreateMessageRequest = {
  recipientId?: string;
  body?: string;
  imageUrls?: string[];
};

type MarkMessagesReadRequest = {
  counterpartId?: string;
};

type NotificationSettingsDocument = {
  ownerId: string;
  settings: Partial<NotificationSettings>;
  updatedAt?: Date;
};

type DirectChatRoomSettingDocument = Omit<DirectChatRoomSetting, "leftAt"> & {
  ownerId: string;
  leftAt?: Date;
  updatedAt?: Date;
};

export async function POST(request: NextRequest) {
  const sender = await getCurrentUser(request);
  if (!sender) return jsonError("로그인이 필요합니다.", 401);
  if (!canSendMapMessage(sender))
    return jsonError("대화를 보낼 권한이 없습니다.", 403);

  const input = await readJson<CreateMessageRequest>(request);
  const recipientId = input.recipientId?.trim();
  const body = input.body?.trim();
  const imageUrls = compactImageUrls(input.imageUrls);

  if (!recipientId) return jsonError("받는 사람을 선택해주세요.");
  if (recipientId === sender.id)
    return jsonError("본인에게는 대화를 보낼 수 없습니다.");
  if (!body && imageUrls.length === 0)
    return jsonError("대화 내용을 입력해주세요.");
  if ((body?.length ?? 0) > 500)
    return jsonError("대화는 500자 이하로 입력해주세요.");

  await ensureMongoIndexes();

  const db = await getMongoDb();
  const recipient = await db
    .collection<UserDocument>("users")
    .findOne({ id: recipientId });
  if (!recipient) return jsonError("대화를 받을 회원을 찾을 수 없습니다.", 404);
  if (!canReceiveDirectMessage(recipient))
    return jsonError("대화를 받을 수 없는 회원 유형입니다.", 403);

  const [senderRoomSetting, recipientRoomSetting] = await Promise.all([
    db.collection<DirectChatRoomSettingDocument>("member_chat_rooms").findOne({
      ownerId: sender.id,
      counterpartId: recipient.id,
    }),
    db.collection<DirectChatRoomSettingDocument>("member_chat_rooms").findOne({
      ownerId: recipient.id,
      counterpartId: sender.id,
    }),
  ]);

  if (senderRoomSetting?.blocked)
    return jsonError("차단한 상대에게는 대화를 보낼 수 없습니다.", 403);
  if (recipientRoomSetting?.blocked)
    return jsonError("상대방에게 대화를 보낼 수 없습니다.", 403);

  const profileIds = [sender.id, recipient.id];
  const profiles = await db
    .collection<MemberProfile & { ownerId?: string }>("member_profiles")
    .find({ ownerId: { $in: profileIds } })
    .toArray();
  const profileByOwnerId = new Map(
    profiles.map((profile) => [profile.ownerId, toDomain(profile)]),
  );

  const now = new Date();
  const message: Omit<DirectMessage, "createdAt"> & { createdAt: Date } = {
    id: randomBytes(16).toString("hex"),
    senderId: sender.id,
    senderName: profileByOwnerId.get(sender.id)?.name ?? sender.name,
    recipientId: recipient.id,
    recipientName: profileByOwnerId.get(recipient.id)?.name ?? recipient.name,
    body: body ?? "",
    imageUrls,
    read: false,
    createdAt: now,
  };

  const notificationSettings = await db
    .collection<NotificationSettingsDocument>("member_notification_settings")
    .findOne({ ownerId: recipient.id });
  const recipientSettings = {
    ...defaultNotificationSettings,
    ...(notificationSettings?.settings ?? {}),
  };

  const writes: Promise<unknown>[] = [
    db.collection("member_messages").insertOne(message),
  ];

  if (recipientSettings.directMessage && !recipientRoomSetting?.muted) {
    const notification: NotificationItem & {
      ownerId: string;
      _createdAt: Date;
    } = {
      ownerId: recipient.id,
      _createdAt: now,
      id: `message-${message.id}`,
      kind: "message",
      title: `${message.senderName}님이 대화를 보냈습니다.`,
      createdAgo: "방금 전",
      unread: true,
      href: `/mypage/messages?thread=${encodeURIComponent(message.senderId)}`,
    };

    writes.push(db.collection("member_notifications").insertOne(notification));
    writes.push(
      sendPushNotification(recipient.id, {
        title: "새 다이렉트 메시지",
        body: notification.title,
        data: { href: notification.href ?? "/mypage/messages" },
      }),
    );
  }

  await Promise.all(writes);

  return NextResponse.json({ success: true, id: message.id }, { status: 201 });
}

function compactImageUrls(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 3);
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const input = await readJson<MarkMessagesReadRequest>(request);
  const counterpartId = input.counterpartId?.trim();
  if (!counterpartId) return jsonError("읽음 처리할 대화를 선택해주세요.");

  await ensureMongoIndexes();

  const db = await getMongoDb();
  await db.collection("member_messages").updateMany(
    {
      senderId: counterpartId,
      recipientId: user.id,
      read: false,
      deletedAt: { $exists: false },
    },
    {
      $set: { read: true },
    },
  );

  return NextResponse.json({ success: true });
}
