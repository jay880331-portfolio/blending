import type { DirectMessage, NotificationItem } from "@/domain/member/types";

export function hasUnreadDirectMessages({
  messages,
  memberId,
}: {
  messages: DirectMessage[];
  memberId: string;
}) {
  return messages.some(
    (message) => message.recipientId === memberId && !message.read,
  );
}

export function hasUnreadMemberUpdates({
  notifications,
  messages,
  profile,
}: {
  notifications: NotificationItem[];
  messages: DirectMessage[];
  profile: { id: string };
}) {
  return (
    notifications.some((notification) => notification.unread) ||
    hasUnreadDirectMessages({ messages, memberId: profile.id })
  );
}
