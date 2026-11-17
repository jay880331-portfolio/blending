type NotificationResponseLike = {
  notification: {
    request: {
      content: {
        data?: Record<string, unknown>;
      };
    };
  };
};

export function notificationResponseUrl(
  response: NotificationResponseLike | null | undefined,
  webViewUrl: string,
) {
  const href = response?.notification.request.content.data?.href;
  if (typeof href !== "string" || href.trim() === "") return null;

  try {
    const appOrigin = new URL(webViewUrl).origin;
    const target = new URL(href, webViewUrl);

    return target.origin === appOrigin ? target.toString() : null;
  } catch {
    return null;
  }
}
