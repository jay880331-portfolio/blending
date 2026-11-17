type WebViewBackState = {
  canGoBack: boolean;
  previousUrl?: string | null;
  url: string;
  webViewUrl: string;
};

type MainWebViewLoadRequest = {
  isTopFrame: boolean;
  url: string;
  webViewUrl: string;
};

const appRootPaths = new Set([
  "/",
  "/chat",
  "/community",
  "/community/b-talk",
  "/community/calendar",
  "/community/events",
  "/community/qa",
  "/community/reviews",
  "/home",
  "/login",
  "/map",
  "/mypage",
  "/partner",
  "/partner/promotions",
  "/partner/reviews",
  "/showroom",
  "/signup",
]);

const embeddedProviderHosts = new Set([
  "postcode.map.daum.net",
  "postcode.map.kakao.com",
]);

export function isHttpUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://");
}

export function isCleartextHttpUrl(url: string) {
  try {
    return new URL(url).protocol === "http:";
  } catch {
    return false;
  }
}

export function isBlankWebViewUrl(url: string) {
  return url === "about:blank";
}

export function isInternalWebViewUrl(url: string, webViewUrl: string) {
  if (isBlankWebViewUrl(url)) return true;
  if (!isHttpUrl(url)) return false;

  try {
    return new URL(url, webViewUrl).origin === new URL(webViewUrl).origin;
  } catch {
    return false;
  }
}

export function isAllowedEmbeddedProviderUrl(url: string) {
  if (!isHttpUrl(url)) return false;

  try {
    return embeddedProviderHosts.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function shouldLoadInMainWebView({
  isTopFrame,
  url,
  webViewUrl,
}: MainWebViewLoadRequest) {
  if (!isTopFrame) return true;
  if (isBlankWebViewUrl(url)) return false;

  return (
    !url ||
    isInternalWebViewUrl(url, webViewUrl) ||
    isAllowedEmbeddedProviderUrl(url)
  );
}

function appRoute(url: string, webViewUrl: string) {
  try {
    const parsedUrl = new URL(url, webViewUrl);

    return {
      path: parsedUrl.pathname.replace(/\/+$/, "") || "/",
      searchParams: parsedUrl.searchParams,
    };
  } catch {
    return {
      path: "/",
      searchParams: new URLSearchParams(),
    };
  }
}

function isAppRootRoute(path: string, searchParams: URLSearchParams) {
  if (path === "/chat" && searchParams.has("recipientId")) return false;

  return appRootPaths.has(path);
}

export function shouldGoBackInWebView({
  canGoBack,
  previousUrl,
  url,
  webViewUrl,
}: WebViewBackState) {
  if (!canGoBack) return false;

  const { path, searchParams } = appRoute(url, webViewUrl);
  if (!isAppRootRoute(path, searchParams)) return true;

  if (!previousUrl) return false;

  const previousRoute = appRoute(previousUrl, webViewUrl);

  return (
    isAppRootRoute(previousRoute.path, previousRoute.searchParams) &&
    previousRoute.path !== path
  );
}
