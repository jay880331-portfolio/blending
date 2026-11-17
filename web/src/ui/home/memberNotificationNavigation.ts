import type { NotificationItem } from "../../domain/member/types";

type NotificationHrefOptions = {
  messageBasePath?: "/home/messages" | "/mypage/messages";
};

export function notificationHref(
  item: NotificationItem,
  options: NotificationHrefOptions = {},
) {
  if (item.kind === "message") {
    const messageBasePath = options.messageBasePath ?? "/mypage/messages";
    if (!item.href) return messageBasePath;

    try {
      const href = new URL(item.href, "http://localhost");
      if (href.pathname.endsWith("/messages")) {
        return `${messageBasePath}${href.search}`;
      }
    } catch {
      return item.href;
    }

    return item.href;
  }

  if (item.href) return item.href;
  return null;
}
