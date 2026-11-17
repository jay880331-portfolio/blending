import {
  isBlankWebViewUrl,
  isAllowedEmbeddedProviderUrl,
  isCleartextHttpUrl,
  isHttpUrl,
  isInternalWebViewUrl,
  shouldLoadInMainWebView,
  shouldGoBackInWebView,
} from "./webViewNavigation";

const webViewOrigin = "https://blending.ridge-it.site";

function assertEqual(actual: boolean, expected: boolean) {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

assertEqual(isHttpUrl("https://example.com"), true);
assertEqual(isHttpUrl("http://example.com"), true);
assertEqual(isHttpUrl("intent://example"), false);
assertEqual(isCleartextHttpUrl("http://example.com/apply"), true);
assertEqual(isCleartextHttpUrl("https://example.com/apply"), false);
assertEqual(isCleartextHttpUrl("intent://example"), false);

assertEqual(isBlankWebViewUrl("about:blank"), true);
assertEqual(isBlankWebViewUrl("https://example.com"), false);

assertEqual(isInternalWebViewUrl("about:blank", webViewOrigin), true);
assertEqual(
  isInternalWebViewUrl(`${webViewOrigin}/partner`, webViewOrigin),
  true,
);
assertEqual(
  isInternalWebViewUrl("https://external.example/partner", webViewOrigin),
  false,
);

assertEqual(
  isAllowedEmbeddedProviderUrl("https://postcode.map.daum.net/search"),
  true,
);
assertEqual(
  isAllowedEmbeddedProviderUrl("https://postcode.map.kakao.com/search"),
  true,
);
assertEqual(isAllowedEmbeddedProviderUrl("https://external.example"), false);

assertEqual(
  shouldLoadInMainWebView({
    isTopFrame: false,
    url: "https://www.youtube-nocookie.com/embed/video-id",
    webViewUrl: webViewOrigin,
  }),
  true,
);
assertEqual(
  shouldLoadInMainWebView({
    isTopFrame: true,
    url: "https://external.example/article",
    webViewUrl: webViewOrigin,
  }),
  false,
);
assertEqual(
  shouldLoadInMainWebView({
    isTopFrame: true,
    url: "about:blank",
    webViewUrl: webViewOrigin,
  }),
  false,
);
assertEqual(
  shouldLoadInMainWebView({
    isTopFrame: true,
    url: `${webViewOrigin}/community/reviews`,
    webViewUrl: webViewOrigin,
  }),
  true,
);
assertEqual(
  shouldLoadInMainWebView({
    isTopFrame: true,
    url: "https://postcode.map.daum.net/search",
    webViewUrl: webViewOrigin,
  }),
  true,
);
assertEqual(
  shouldLoadInMainWebView({
    isTopFrame: true,
    url: "intent://example",
    webViewUrl: webViewOrigin,
  }),
  false,
);

assertEqual(
  shouldGoBackInWebView({
    canGoBack: true,
    previousUrl: `${webViewOrigin}/home`,
    url: `${webViewOrigin}/mypage`,
    webViewUrl: webViewOrigin,
  }),
  true,
);

assertEqual(
  shouldGoBackInWebView({
    canGoBack: true,
    previousUrl: `${webViewOrigin}/mypage`,
    url: `${webViewOrigin}/mypage?tab=account`,
    webViewUrl: webViewOrigin,
  }),
  false,
);

assertEqual(
  shouldGoBackInWebView({
    canGoBack: true,
    url: `${webViewOrigin}/home`,
    webViewUrl: webViewOrigin,
  }),
  false,
);

assertEqual(
  shouldGoBackInWebView({
    canGoBack: true,
    url: `${webViewOrigin}/community/reviews`,
    webViewUrl: webViewOrigin,
  }),
  false,
);

assertEqual(
  shouldGoBackInWebView({
    canGoBack: true,
    url: `${webViewOrigin}/showroom`,
    webViewUrl: webViewOrigin,
  }),
  false,
);

assertEqual(
  shouldGoBackInWebView({
    canGoBack: true,
    previousUrl: `${webViewOrigin}/home`,
    url: `${webViewOrigin}/showroom`,
    webViewUrl: webViewOrigin,
  }),
  true,
);

assertEqual(
  shouldGoBackInWebView({
    canGoBack: true,
    url: `${webViewOrigin}/chat?recipientId=member-1`,
    webViewUrl: webViewOrigin,
  }),
  true,
);

assertEqual(
  shouldGoBackInWebView({
    canGoBack: true,
    url: `${webViewOrigin}/chat`,
    webViewUrl: webViewOrigin,
  }),
  false,
);

assertEqual(
  shouldGoBackInWebView({
    canGoBack: true,
    url: `${webViewOrigin}/community/reviews/review-1`,
    webViewUrl: webViewOrigin,
  }),
  true,
);

assertEqual(
  shouldGoBackInWebView({
    canGoBack: false,
    url: `${webViewOrigin}/community/reviews/review-1`,
    webViewUrl: webViewOrigin,
  }),
  false,
);
