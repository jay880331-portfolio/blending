import Constants from "expo-constants";

const developmentWebViewUrl = "http://localhost:3000";
const productionWebViewUrl = "https://blending.ridge-it.site";

function developmentHostWebViewUrl() {
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return host ? `http://${host}:3000` : developmentWebViewUrl;
}

export const webViewUrl =
  process.env.EXPO_PUBLIC_WEB_URL ??
  (__DEV__ ? developmentHostWebViewUrl() : productionWebViewUrl);

export const appTokenKey = "blending.appToken";

export const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? "";

export const kakaoNativeAppKey =
  process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY ?? "";

export const naverClientId = process.env.EXPO_PUBLIC_NAVER_CLIENT_ID ?? "";
export const naverClientSecret =
  process.env.EXPO_PUBLIC_NAVER_CLIENT_SECRET ?? "";
export const naverUrlScheme =
  process.env.EXPO_PUBLIC_NAVER_URL_SCHEME ?? "blendingnaver";
