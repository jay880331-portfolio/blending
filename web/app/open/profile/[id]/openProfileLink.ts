const playStoreUrl =
  "https://play.google.com/store/apps/details?id=com.blending.app";
const appStoreUrl = "https://apps.apple.com/kr/app/blending/id6783152611";

export function encodedProfileId(profileId: string) {
  return encodeURIComponent(profileId);
}

export function profileDeepLink(profileId: string) {
  return `blending://profile/${encodedProfileId(profileId)}`;
}

export function androidProfileIntent(profileId: string) {
  return `intent://profile/${encodedProfileId(profileId)}#Intent;scheme=blending;package=com.blending.app;S.browser_fallback_url=${encodeURIComponent(playStoreUrl)};end`;
}

export function profileWebHref(profileId: string) {
  return `/profile/${encodedProfileId(profileId)}`;
}

export { appStoreUrl };
