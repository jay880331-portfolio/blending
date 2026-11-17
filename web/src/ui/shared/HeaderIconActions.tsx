"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Bell, Search } from "lucide-react";
import {
  hasUnreadDirectMessages,
  hasUnreadMemberUpdates,
} from "@/domain/member/unread";
import { useMemberStore } from "@/store/memberStore";

type HeaderIconActionsProps = {
  notificationHref?: string;
  searchHref?: string;
  searchLabel?: string;
  onNotificationClick?: () => void;
  onSearchClick?: () => void;
  hasUnreadNotifications?: boolean;
  loadUnreadNotifications?: boolean;
};

export function HeaderIconActions({
  notificationHref,
  searchHref,
  searchLabel = "검색",
  onNotificationClick,
  onSearchClick,
  hasUnreadNotifications,
  loadUnreadNotifications = false,
}: HeaderIconActionsProps) {
  const snapshot = useMemberStore((state) => state.snapshot);
  const status = useMemberStore((state) => state.status);
  const load = useMemberStore((state) => state.load);
  const storeUnread = snapshot ? hasUnreadMemberUpdates(snapshot) : undefined;
  const showUnreadDot = hasUnreadNotifications ?? storeUnread ?? false;
  const unreadMessage = snapshot?.messages.find(
    (message) => message.recipientId === snapshot.profile.id && !message.read,
  );
  const hasUnreadMessagesOnly =
    snapshot &&
    snapshot.notifications.every((notification) => !notification.unread) &&
    hasUnreadDirectMessages({
      messages: snapshot.messages,
      memberId: snapshot.profile.id,
    });
  const resolvedNotificationHref =
    notificationHref ??
    (hasUnreadMessagesOnly && unreadMessage
      ? `/home/messages?thread=${encodeURIComponent(unreadMessage.senderId)}`
      : "/home/notifications");

  useEffect(() => {
    if (
      !loadUnreadNotifications ||
      hasUnreadNotifications !== undefined ||
      snapshot ||
      status !== "idle"
    )
      return;

    void load();
  }, [hasUnreadNotifications, load, loadUnreadNotifications, snapshot, status]);

  return (
    <div className="flex h-11 w-[84px] items-center justify-center gap-1">
      <Link
        href={resolvedNotificationHref}
        prefetch={false}
        aria-label="알림"
        onClick={onNotificationClick}
        className="relative flex h-11 w-10 items-center justify-center text-[var(--fg)]"
      >
        <Bell size={23} strokeWidth={2} />
        {showUnreadDot ? (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-[var(--radius-pill)] bg-[var(--accent)]" />
        ) : null}
      </Link>
      {onSearchClick ? (
        <button
          type="button"
          aria-label={searchLabel}
          onClick={onSearchClick}
          className="flex h-11 w-10 items-center justify-center text-[var(--fg)]"
        >
          <Search size={24} strokeWidth={2.2} />
        </button>
      ) : (
        <Link
          href={searchHref ?? "/home/search"}
          prefetch={false}
          aria-label={searchLabel}
          className="flex h-11 w-10 items-center justify-center text-[var(--fg)]"
        >
          <Search size={24} strokeWidth={2.2} />
        </Link>
      )}
    </div>
  );
}
