export function profileUrlFromDeepLink(url: string, webViewUrl: string) {
  try {
    const deepLink = new URL(url);
    if (deepLink.protocol !== "blending:" || deepLink.hostname !== "profile") {
      return null;
    }

    const profileId = decodeURIComponent(deepLink.pathname.slice(1));
    if (!profileId || deepLink.pathname.split("/").length !== 2) return null;

    return new URL(
      `/profile/${encodeURIComponent(profileId)}`,
      webViewUrl,
    ).toString();
  } catch {
    return null;
  }
}
