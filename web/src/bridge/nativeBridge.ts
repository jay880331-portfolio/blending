"use client";

import type { AppBridge } from "@blending/bridge";
import { linkBridge } from "@webview-bridge/web";

export const nativeBridge = linkBridge<AppBridge>({
  debug: process.env.NEXT_PUBLIC_WEBVIEW_BRIDGE_DEBUG === "true",
  timeout: 30000,
  throwOnError: [
    "getAppToken",
    "openCamera",
    "pickImages",
    "getPushToken",
    "openNotificationSettings",
    "openAppSettings",
    "getAppInfo",
    "openExternalUrl",
    "shareContent",
    "shareFile",
    "saveFile",
    "shareImageAsPdf",
    "getCurrentLocation",
    "loginWithKakao",
    "loginWithNaver",
    "loginWithApple",
  ],
});

export const isNativeBridgeAvailable = () =>
  nativeBridge.isWebViewBridgeAvailable;
