import type {
  NativeAppleLoginResult,
  NativeBridge,
  NativeSocialLoginProvider,
  NativeSocialLoginResult,
} from "@blending/bridge";
import { initializeKakaoSDK } from "@react-native-kakao/core";
import KakaoUser from "@react-native-kakao/user";
import NaverLogin from "@react-native-seoul/naver-login";
import { bridge } from "@webview-bridge/react-native";
import * as Application from "expo-application";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import { EncodingType, File, Paths } from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform, Share } from "react-native";

import {
  appTokenKey,
  easProjectId,
  kakaoNativeAppKey,
  naverClientId,
  naverClientSecret,
  naverUrlScheme,
} from "./config";

const appName = "Blending";
const LOCATION_LAST_KNOWN_MAX_AGE_MS = 60_000;
const LOCATION_LAST_KNOWN_REQUIRED_ACCURACY_METERS = 2_000;
const LOCATION_HIGH_ACCURACY_TIMEOUT_MS =
  Platform.OS === "ios" ? 14_000 : 8_000;
const LOCATION_FALLBACK_TIMEOUT_MS = Platform.OS === "ios" ? 8_000 : 5_000;
const LOCATION_PREWARM_TIMEOUT_MS = Platform.OS === "ios" ? 8_000 : 5_000;
const IMAGE_UPLOAD_MAX_DIMENSION = 1920;
const IMAGE_UPLOAD_QUALITY = 0.8;
let kakaoInitPromise: Promise<void> | null = null;
let naverInitialized = false;
let prewarmedLocation: Location.LocationObject | null = null;

export const isExpoGo = Constants.appOwnership === "expo";
type NotificationsModule = typeof import("expo-notifications");

function nativePlatform() {
  return Platform.OS === "android" || Platform.OS === "ios"
    ? Platform.OS
    : "unknown";
}

function parseNativeBuildNumber(buildVersion: string | null) {
  if (!buildVersion) return null;

  const buildNumber = Number.parseInt(buildVersion, 10);
  return Number.isFinite(buildNumber) ? buildNumber : null;
}

function safeBridgeFileName(fileName: string, fallback: string) {
  const safeName = fileName.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  return safeName || fallback;
}

function fileNameWithoutExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

async function shareCachedFile(
  uri: string,
  title: string | undefined,
  mimeType: "image/png" | "application/pdf",
) {
  if (!(await Sharing.isAvailableAsync())) {
    return {
      status: "failed" as const,
      message: "파일 공유를 사용할 수 없습니다.",
    };
  }

  await Sharing.shareAsync(uri, {
    dialogTitle: title,
    mimeType,
    UTI: mimeType === "application/pdf" ? "com.adobe.pdf" : "public.png",
  });

  return { status: "shared" as const };
}

function toLocationResult(
  location: Location.LocationObject,
  permission: Location.LocationPermissionResponse,
  source: "current" | "fallback" | "last-known",
  elapsedMs: number,
) {
  return {
    granted: true,
    canAskAgain: permission.canAskAgain,
    status: permission.status,
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    accuracy: location.coords.accuracy,
    timestamp: location.timestamp,
    elapsedMs,
    platform: nativePlatform(),
    source,
  } as const;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
) {
  let timeout: ReturnType<typeof setTimeout>;

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timeout));
}

async function getLastKnownLocation() {
  if (
    prewarmedLocation &&
    Date.now() - prewarmedLocation.timestamp <=
      LOCATION_LAST_KNOWN_MAX_AGE_MS &&
    (prewarmedLocation.coords.accuracy === null ||
      prewarmedLocation.coords.accuracy <=
        LOCATION_LAST_KNOWN_REQUIRED_ACCURACY_METERS)
  ) {
    return prewarmedLocation;
  }

  try {
    return await Location.getLastKnownPositionAsync({
      maxAge: LOCATION_LAST_KNOWN_MAX_AGE_MS,
      requiredAccuracy: LOCATION_LAST_KNOWN_REQUIRED_ACCURACY_METERS,
    });
  } catch {
    return null;
  }
}

export async function prewarmCurrentLocation() {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return;

  try {
    prewarmedLocation = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      LOCATION_PREWARM_TIMEOUT_MS,
      "Location prewarm timed out.",
    );
  } catch (error) {
    if (__DEV__) {
      console.warn("[location] Prewarm failed.", {
        platform: nativePlatform(),
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function socialLoginFailure(
  provider: NativeSocialLoginProvider,
  error: unknown,
): NativeSocialLoginResult {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  return {
    success: false,
    provider,
    cancelled:
      lowerMessage.includes("cancel") || lowerMessage.includes("cancelled"),
    message,
  };
}

function appleLoginFailure(error: unknown): NativeAppleLoginResult {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  return {
    success: false,
    provider: "apple",
    cancelled:
      lowerMessage.includes("cancel") || lowerMessage.includes("canceled"),
    message,
  };
}

function ensureKakaoInitialized() {
  if (!kakaoNativeAppKey) {
    throw new Error("EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY is not configured.");
  }

  kakaoInitPromise ??= initializeKakaoSDK(kakaoNativeAppKey);
  return kakaoInitPromise;
}

function ensureNaverInitialized() {
  if (!naverClientId || !naverClientSecret) {
    throw new Error(
      "EXPO_PUBLIC_NAVER_CLIENT_ID or EXPO_PUBLIC_NAVER_CLIENT_SECRET is not configured.",
    );
  }

  if (naverInitialized) return;

  NaverLogin.initialize({
    appName,
    consumerKey: naverClientId,
    consumerSecret: naverClientSecret,
    serviceUrlSchemeIOS: naverUrlScheme,
  });
  naverInitialized = true;
}

async function requestNotificationPermission(
  Notifications: NotificationsModule,
) {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "기본 알림",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return existing;

  return Notifications.requestPermissionsAsync();
}

function imageResizeAction(width: number, height: number) {
  if (
    width <= IMAGE_UPLOAD_MAX_DIMENSION &&
    height <= IMAGE_UPLOAD_MAX_DIMENSION
  )
    return null;

  return width >= height
    ? { resize: { width: IMAGE_UPLOAD_MAX_DIMENSION } }
    : { resize: { height: IMAGE_UPLOAD_MAX_DIMENSION } };
}

function jpegFileName(fileName: string | null | undefined) {
  const baseName = fileName ?? `image-${Date.now()}`;
  return /\.[^.]+$/.test(baseName)
    ? baseName.replace(/\.[^.]+$/, ".jpg")
    : `${baseName}.jpg`;
}

async function preparePickedImageForUpload(
  asset: ImagePicker.ImagePickerAsset,
) {
  const resizeAction = imageResizeAction(asset.width, asset.height);
  const prepared = await ImageManipulator.manipulateAsync(
    asset.uri,
    resizeAction ? [resizeAction] : [],
    {
      base64: true,
      compress: IMAGE_UPLOAD_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  return {
    uri: prepared.uri,
    width: prepared.width,
    height: prepared.height,
    mimeType: "image/jpeg",
    fileName: jpegFileName(asset.fileName),
    base64: prepared.base64 ?? undefined,
  };
}

export const appBridge = bridge<NativeBridge>({
  async getAppToken() {
    const token = await SecureStore.getItemAsync(appTokenKey);

    return { token };
  },

  async openCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      return { canceled: true };
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      mediaTypes: ["images"],
      quality: 0.9,
    });

    if (result.canceled || !result.assets[0]) {
      return { canceled: true };
    }

    const asset = result.assets[0];

    return {
      canceled: false,
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      mimeType: asset.mimeType,
    };
  },

  async pickImages({ selectionLimit }) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      return { canceled: true };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      base64: false,
      mediaTypes: ["images"],
      quality: IMAGE_UPLOAD_QUALITY,
      selectionLimit,
    });

    if (result.canceled || result.assets.length === 0) {
      return { canceled: true };
    }

    const assets = await Promise.all(
      result.assets.slice(0, selectionLimit).map(preparePickedImageForUpload),
    );

    return {
      canceled: false,
      assets,
    };
  },

  async getPushToken() {
    if (isExpoGo) {
      return {
        granted: false,
        canAskAgain: false,
        status: "expo-go-unsupported",
      };
    }

    const Notifications = await import("expo-notifications");
    const permission = await requestNotificationPermission(Notifications);

    if (!permission.granted) {
      return {
        granted: false,
        canAskAgain: permission.canAskAgain,
        status: permission.status,
      };
    }

    const token = await Notifications.getExpoPushTokenAsync(
      easProjectId ? { projectId: easProjectId } : undefined,
    );

    return {
      granted: true,
      canAskAgain: permission.canAskAgain,
      status: permission.status,
      token: token.data,
      platform:
        Platform.OS === "android" || Platform.OS === "ios"
          ? Platform.OS
          : "unknown",
    };
  },

  async openNotificationSettings() {
    if (isExpoGo) {
      return {
        granted: false,
        canAskAgain: false,
        status: "expo-go-unsupported",
      };
    }

    const Notifications = await import("expo-notifications");
    const permission = await Notifications.requestPermissionsAsync();

    if (!permission.granted && !permission.canAskAgain) {
      await Linking.openSettings();
    }

    return {
      granted: permission.granted,
      canAskAgain: permission.canAskAgain,
      status: permission.status,
    };
  },

  async openAppSettings() {
    await Linking.openSettings();

    return { opened: true };
  },

  async getAppInfo() {
    return {
      appId: Application.applicationId,
      version: Application.nativeApplicationVersion,
      buildVersion: Application.nativeBuildVersion,
      buildNumber: parseNativeBuildNumber(Application.nativeBuildVersion),
      platform: nativePlatform(),
    };
  },

  async openExternalUrl({ url }) {
    await Linking.openURL(url);

    return { opened: true };
  },

  async shareContent({ title, message, url }) {
    const shareMessage = [message, url].filter(Boolean).join("\n").trim();
    if (!shareMessage) {
      return { status: "failed", message: "공유할 내용이 없습니다." };
    }

    try {
      const result = await Share.share(
        { message: shareMessage, title },
        { dialogTitle: title },
      );

      if (result.action === Share.dismissedAction) {
        return { status: "dismissed" };
      }

      return {
        status: "shared",
        activityType: result.activityType ?? undefined,
      };
    } catch (error) {
      return {
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async shareFile({ title, fileName, mimeType, base64 }) {
    try {
      const file = new File(
        Paths.cache,
        safeBridgeFileName(
          fileName,
          mimeType === "application/pdf"
            ? "blending-card.pdf"
            : "blending-card.png",
        ),
      );
      file.create({ overwrite: true });
      file.write(base64, { encoding: EncodingType.Base64 });

      return await shareCachedFile(file.uri, title, mimeType);
    } catch (error) {
      return {
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async saveFile({ title, fileName, mimeType, base64 }) {
    try {
      const safeName = safeBridgeFileName(
        fileName,
        mimeType === "application/pdf"
          ? "blending-card.pdf"
          : "blending-card.png",
      );

      if (Platform.OS === "android") {
        const directory =
          LegacyFileSystem.StorageAccessFramework.getUriForDirectoryInRoot(
            "Download",
          );
        const permission =
          await LegacyFileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
            directory,
          );

        if (!permission.granted) return { status: "dismissed" };

        const uri =
          await LegacyFileSystem.StorageAccessFramework.createFileAsync(
            permission.directoryUri,
            fileNameWithoutExtension(safeName),
            mimeType,
          );
        await LegacyFileSystem.StorageAccessFramework.writeAsStringAsync(
          uri,
          base64,
          { encoding: LegacyFileSystem.EncodingType.Base64 },
        );

        return { status: "saved", uri };
      }

      if (!LegacyFileSystem.documentDirectory) {
        return {
          status: "failed",
          message: "파일 저장 경로를 찾을 수 없습니다.",
        };
      }

      const uri = `${LegacyFileSystem.documentDirectory}${safeName}`;
      await LegacyFileSystem.writeAsStringAsync(uri, base64, {
        encoding: LegacyFileSystem.EncodingType.Base64,
      });

      const result = await shareCachedFile(uri, title, mimeType);
      if (result.status === "failed") return result;

      return { status: "saved", uri };
    } catch (error) {
      return {
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async shareImageAsPdf({ title, fileName, imageBase64 }) {
    try {
      const { uri } = await Print.printToFileAsync({
        html: `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page { margin: 12mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #ffffff;
      }
      img {
        display: block;
        width: 100%;
        max-width: 180mm;
        height: auto;
      }
    </style>
  </head>
  <body>
    <img src="data:image/png;base64,${imageBase64}" />
  </body>
</html>`,
      });
      const pdfFile = new File(
        Paths.cache,
        safeBridgeFileName(fileName, "blending-card.pdf"),
      );
      await new File(uri).copy(pdfFile, { overwrite: true });

      return await shareCachedFile(pdfFile.uri, title, "application/pdf");
    } catch (error) {
      return {
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async getCurrentLocation({ preferLastKnown = false } = {}) {
    const startedAt = Date.now();
    const permission = await Location.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      return {
        granted: false,
        canAskAgain: permission.canAskAgain,
        status: permission.status,
        elapsedMs: Date.now() - startedAt,
        platform: nativePlatform(),
      };
    }

    const lastKnownLocation = await getLastKnownLocation();
    if (preferLastKnown && lastKnownLocation) {
      return toLocationResult(
        lastKnownLocation,
        permission,
        "last-known",
        Date.now() - startedAt,
      );
    }

    try {
      const currentLocation = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        }),
        LOCATION_HIGH_ACCURACY_TIMEOUT_MS,
        "High accuracy location request timed out.",
      );

      return toLocationResult(
        currentLocation,
        permission,
        "current",
        Date.now() - startedAt,
      );
    } catch (error) {
      console.warn("[location] High accuracy request failed.", {
        elapsedMs: Date.now() - startedAt,
        platform: nativePlatform(),
        message: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      const fallbackLocation = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        LOCATION_FALLBACK_TIMEOUT_MS,
        "Balanced location request timed out.",
      );

      return toLocationResult(
        fallbackLocation,
        permission,
        "fallback",
        Date.now() - startedAt,
      );
    } catch (error) {
      console.warn("[location] Balanced fallback request failed.", {
        elapsedMs: Date.now() - startedAt,
        platform: nativePlatform(),
        message: error instanceof Error ? error.message : String(error),
      });
    }

    if (lastKnownLocation) {
      return toLocationResult(
        lastKnownLocation,
        permission,
        "last-known",
        Date.now() - startedAt,
      );
    }

    throw new Error("Current location is unavailable.");
  },

  async loginWithKakao() {
    try {
      await ensureKakaoInitialized();

      let token;
      try {
        token = await KakaoUser.login({ useKakaoAccountLogin: false });
      } catch {
        token = await KakaoUser.login({ useKakaoAccountLogin: true });
      }

      return {
        success: true,
        provider: "kakao",
        accessToken: token.accessToken,
      };
    } catch (error) {
      return socialLoginFailure("kakao", error);
    }
  },

  async loginWithNaver() {
    try {
      ensureNaverInitialized();

      const response = await NaverLogin.login();
      if (!response.isSuccess || !response.successResponse?.accessToken) {
        return {
          success: false,
          provider: "naver",
          cancelled: response.failureResponse?.isCancel ?? false,
          message:
            response.failureResponse?.message ??
            "네이버 로그인 토큰을 가져오지 못했습니다.",
        };
      }

      return {
        success: true,
        provider: "naver",
        accessToken: response.successResponse.accessToken,
      };
    } catch (error) {
      return socialLoginFailure("naver", error);
    }
  },

  async loginWithApple({ nonce, state }) {
    try {
      if (
        Platform.OS !== "ios" ||
        !(await AppleAuthentication.isAvailableAsync())
      ) {
        throw new Error("Apple 로그인을 사용할 수 없습니다.");
      }

      const credential = await AppleAuthentication.signInAsync({
        nonce,
        state,
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error("Apple identity token을 가져오지 못했습니다.");
      }

      return {
        success: true,
        provider: "apple",
        identityToken: credential.identityToken,
        authorizationCode: credential.authorizationCode,
        user: credential.user,
        email: credential.email,
        fullName: credential.fullName,
        state: credential.state,
      };
    } catch (error) {
      return appleLoginFailure(error);
    }
  },
});
