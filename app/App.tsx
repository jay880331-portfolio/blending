import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import type { NotificationResponse } from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import {
  BackHandler,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
  StatusBar as NativeStatusBar,
} from "react-native";
import type WebViewHandle from "react-native-webview";
import {
  WebView as PlainWebView,
  type WebViewNavigation,
  type WebViewProps,
} from "react-native-webview";
import { createWebView } from "@webview-bridge/react-native";
import { ArrowLeft } from "lucide-react-native";

import { webViewUrl } from "./src/config";
import {
  appBridge,
  isExpoGo,
  prewarmCurrentLocation,
} from "./src/nativeBridge";
import { nextAndroidRootBackAction } from "./src/androidBackExit";
import { notificationResponseUrl } from "./src/notificationNavigation";
import { profileUrlFromDeepLink } from "./src/profileDeepLink";
import { SplashOverlay } from "./src/SplashOverlay";
import {
  isBlankWebViewUrl,
  isCleartextHttpUrl,
  isHttpUrl,
  isInternalWebViewUrl,
  shouldLoadInMainWebView,
  shouldGoBackInWebView,
} from "./src/webViewNavigation";

const { WebView } = createWebView({
  bridge: appBridge,
  debug: __DEV__,
  responseTimeout: 10000,
});

if (!isExpoGo) {
  void SplashScreen.preventAutoHideAsync();
  SplashScreen.setOptions({
    duration: 300,
    fade: true,
  });
}

type ShouldStartLoadHandler = NonNullable<
  WebViewProps["onShouldStartLoadWithRequest"]
>;

function intentFallbackUrl(url: string) {
  const fallback = url.match(/;S\.browser_fallback_url=([^;]+)/)?.[1];
  return fallback ? decodeURIComponent(fallback) : null;
}

function externalLinkTitle(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "외부 링크";
  }
}

async function openExternalUrl(url: string) {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) await Linking.openURL(url);
  } catch {
    // Ignore unsupported provider app schemes and keep the WebView stable.
  }
}

function BackArrowIcon() {
  return <ArrowLeft color="#000" size={25} strokeWidth={2.2} />;
}

export default function App() {
  const webViewRef = useRef<WebViewHandle>(null);
  const nativeSplashHiddenRef = useRef(false);
  const lastNavigationUrlRef = useRef<string | null>(null);
  const lastExitPromptedAtRef = useRef<number | null>(null);
  const [webViewSourceUri, setWebViewSourceUri] = useState(webViewUrl);
  const [externalWebViewUrl, setExternalWebViewUrl] = useState<string | null>(
    null,
  );
  const [splashVisible, setSplashVisible] = useState(true);
  const [webViewReady, setWebViewReady] = useState(false);
  const [shouldHandleBackPress, setShouldHandleBackPress] = useState(false);
  const safeWebViewSourceUri = isHttpUrl(webViewSourceUri)
    ? webViewSourceUri
    : webViewUrl;
  const safeExternalWebViewUrl =
    externalWebViewUrl && isHttpUrl(externalWebViewUrl)
      ? externalWebViewUrl
      : null;

  const handleSplashLayout = useCallback(() => {
    if (isExpoGo || nativeSplashHiddenRef.current) return;

    nativeSplashHiddenRef.current = true;
    void SplashScreen.hideAsync();
  }, []);

  const handleSplashHidden = useCallback(() => setSplashVisible(false), []);
  const handleWebViewLoadEnd = useCallback(() => setWebViewReady(true), []);

  const openNotificationResponse = useCallback(
    (response: NotificationResponse | null) => {
      const url = notificationResponseUrl(response, webViewUrl);
      if (!url) return;

      setWebViewSourceUri(url);
      webViewRef.current?.injectJavaScript(
        `window.location.href = ${JSON.stringify(url)}; true;`,
      );
    },
    [],
  );

  const openProfileDeepLink = useCallback((url: string | null) => {
    if (!url) return;

    const profileUrl = profileUrlFromDeepLink(url, webViewUrl);
    if (!profileUrl) return;

    setWebViewSourceUri(profileUrl);
    webViewRef.current?.injectJavaScript(
      `window.location.href = ${JSON.stringify(profileUrl)}; true;`,
    );
  }, []);

  const handleAndroidBackPress = useCallback(() => {
    if (externalWebViewUrl) {
      setExternalWebViewUrl(null);
      return true;
    }

    if (shouldHandleBackPress) {
      webViewRef.current?.goBack();
      return true;
    }

    const now = Date.now();
    const action = nextAndroidRootBackAction(
      lastExitPromptedAtRef.current,
      now,
    );

    if (action === "exit") {
      BackHandler.exitApp();
      return true;
    }

    lastExitPromptedAtRef.current = now;
    ToastAndroid.show("한 번 더 누르면 종료됩니다.", ToastAndroid.SHORT);
    return true;
  }, [externalWebViewUrl, shouldHandleBackPress]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      handleAndroidBackPress,
    );

    return () => subscription.remove();
  }, [handleAndroidBackPress]);

  useEffect(() => {
    if (isExpoGo) return;

    let subscription: { remove: () => void } | null = null;
    void import("expo-notifications").then((Notifications) => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      subscription = Notifications.addNotificationResponseReceivedListener(
        openNotificationResponse,
      );

      void Notifications.getLastNotificationResponseAsync().then(
        openNotificationResponse,
      );
    });

    return () => subscription?.remove();
  }, [openNotificationResponse]);

  useEffect(() => {
    void Linking.getInitialURL().then(openProfileDeepLink);
    const subscription = Linking.addEventListener("url", ({ url }) => {
      openProfileDeepLink(url);
    });

    return () => subscription.remove();
  }, [openProfileDeepLink]);

  useEffect(() => {
    void prewarmCurrentLocation();
  }, []);

  const handleNavigationStateChange = useCallback(
    (navigation: WebViewNavigation) => {
      const previousUrl = lastNavigationUrlRef.current;

      setShouldHandleBackPress(
        shouldGoBackInWebView({
          canGoBack: navigation.canGoBack,
          previousUrl,
          url: navigation.url,
          webViewUrl,
        }),
      );

      if (navigation.url) {
        lastNavigationUrlRef.current = navigation.url;
      }
    },
    [],
  );

  const handleShouldStartLoadWithRequest = useCallback<ShouldStartLoadHandler>(
    (request) => {
      const { isTopFrame, url } = request;
      if (shouldLoadInMainWebView({ isTopFrame, url, webViewUrl })) return true;
      if (isBlankWebViewUrl(url)) return false;

      if (isCleartextHttpUrl(url)) {
        void openExternalUrl(url);
        return false;
      }

      if (isHttpUrl(url)) {
        setExternalWebViewUrl(url);
        return false;
      }

      const fallbackUrl = url.startsWith("intent://")
        ? intentFallbackUrl(url)
        : null;

      void openExternalUrl(fallbackUrl ?? url);
      return false;
    },
    [],
  );

  const handleExternalShouldStartLoadWithRequest =
    useCallback<ShouldStartLoadHandler>((request) => {
      const { url } = request;
      if (!url) return true;

      if (isBlankWebViewUrl(url)) return false;

      if (isInternalWebViewUrl(url, webViewUrl)) {
        setExternalWebViewUrl(null);
        if (isHttpUrl(url)) {
          setWebViewSourceUri(url);
          webViewRef.current?.injectJavaScript(
            `window.location.href = ${JSON.stringify(url)}; true;`,
          );
        }
        return false;
      }

      if (isCleartextHttpUrl(url)) {
        void openExternalUrl(url);
        return false;
      }

      if (isHttpUrl(url)) return true;

      const fallbackUrl = url.startsWith("intent://")
        ? intentFallbackUrl(url)
        : null;

      void openExternalUrl(fallbackUrl ?? url);
      return false;
    }, []);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: safeWebViewSourceUri }}
        style={styles.webView}
        originWhitelist={["http://*", "https://*"]}
        allowsBackForwardNavigationGestures={Platform.OS === "ios"}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        onLoadEnd={handleWebViewLoadEnd}
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
      />
      <Modal
        visible={Boolean(safeExternalWebViewUrl)}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setExternalWebViewUrl(null)}
      >
        {safeExternalWebViewUrl ? (
          <SafeAreaView style={styles.externalContainer}>
            <View style={styles.externalHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="앱으로 돌아가기"
                onPress={() => setExternalWebViewUrl(null)}
                style={styles.externalBackButton}
              >
                <BackArrowIcon />
              </Pressable>
              <Text numberOfLines={1} style={styles.externalTitle}>
                {externalLinkTitle(safeExternalWebViewUrl)}
              </Text>
              <View style={styles.externalHeaderSpacer} />
            </View>
            <PlainWebView
              source={{ uri: safeExternalWebViewUrl }}
              style={styles.webView}
              originWhitelist={["http://*", "https://*"]}
              allowsBackForwardNavigationGestures={Platform.OS === "ios"}
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              setSupportMultipleWindows={false}
              onShouldStartLoadWithRequest={
                handleExternalShouldStartLoadWithRequest
              }
            />
          </SafeAreaView>
        ) : null}
      </Modal>
      {splashVisible ? (
        <SplashOverlay
          onHidden={handleSplashHidden}
          onLayout={handleSplashLayout}
          ready={webViewReady}
        />
      ) : null}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? NativeStatusBar.currentHeight : 0,
    backgroundColor: "#fff",
  },
  webView: {
    flex: 1,
  },
  externalContainer: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? NativeStatusBar.currentHeight : 0,
    backgroundColor: "#fff",
  },
  externalHeader: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ded8cf",
    backgroundColor: "#fff",
  },
  externalBackButton: {
    width: 44,
    height: 44,
    marginLeft: 6,
    marginRight: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  externalTitle: {
    flex: 1,
    textAlign: "center",
    color: "#201a17",
    fontSize: 18,
    fontWeight: "700",
  },
  externalHeaderSpacer: {
    width: 56,
  },
});
