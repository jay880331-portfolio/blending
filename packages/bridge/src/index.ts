import type { BridgeStore } from "@webview-bridge/types";

export type AppTokenResult = {
  token: string | null;
};

export type NativeCameraResult =
  | {
      canceled: true;
    }
  | {
      canceled: false;
      uri: string;
      width: number;
      height: number;
      mimeType?: string;
    };

export type NativePickedImageAsset = {
  uri: string;
  width: number;
  height: number;
  mimeType?: string;
  fileName?: string;
  base64?: string;
};

export type NativeImagePickerResult =
  | {
      canceled: true;
    }
  | {
      canceled: false;
      assets: NativePickedImageAsset[];
    };

export type NotificationSettingsResult = {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
};

export type PushTokenResult =
  | {
      granted: false;
      canAskAgain: boolean;
      status: string;
    }
  | {
      granted: true;
      canAskAgain: boolean;
      status: string;
      token: string;
      platform: "android" | "ios" | "web" | "unknown";
    };

export type AppSettingsResult = {
  opened: boolean;
};

export type NativeAppInfoResult = {
  appId: string | null;
  version: string | null;
  buildVersion: string | null;
  buildNumber: number | null;
  platform: "android" | "ios" | "web" | "unknown";
};

export type NativeOpenUrlResult = {
  opened: boolean;
};

export type NativeShareContentInput = {
  title?: string;
  message?: string;
  url?: string;
};

export type NativeShareFileInput = {
  title?: string;
  fileName: string;
  mimeType: "image/png" | "application/pdf";
  base64: string;
};

export type NativeShareImageAsPdfInput = {
  title?: string;
  fileName: string;
  imageBase64: string;
};

export type NativeShareContentResult =
  | {
      status: "shared";
      activityType?: string;
    }
  | {
      status: "dismissed";
    }
  | {
      status: "failed";
      message: string;
    };

export type NativeSaveFileResult =
  | {
      status: "saved";
      uri?: string;
    }
  | {
      status: "dismissed";
    }
  | {
      status: "failed";
      message: string;
    };

export type NativeLocationInput = {
  preferLastKnown?: boolean;
};

export type NativeLocationResult =
  | {
      granted: false;
      canAskAgain: boolean;
      status: string;
      elapsedMs?: number;
      platform?: "android" | "ios" | "web" | "unknown";
    }
  | {
      granted: true;
      canAskAgain: boolean;
      status: string;
      lat: number;
      lng: number;
      accuracy: number | null;
      timestamp: number;
      elapsedMs?: number;
      platform?: "android" | "ios" | "web" | "unknown";
      source?: "current" | "fallback" | "last-known";
    };

export type NativeSocialLoginProvider = "kakao" | "naver";

export type NativeSocialLoginResult =
  | {
      success: false;
      provider: NativeSocialLoginProvider;
      cancelled: boolean;
      message?: string;
    }
  | {
      success: true;
      provider: NativeSocialLoginProvider;
      accessToken: string;
    };

export type NativeAppleFullName = {
  namePrefix: string | null;
  givenName: string | null;
  middleName: string | null;
  familyName: string | null;
  nameSuffix: string | null;
  nickname: string | null;
};

export type NativeAppleLoginInput = {
  nonce: string;
  state: string;
};

export type NativeAppleLoginResult =
  | {
      success: false;
      provider: "apple";
      cancelled: boolean;
      message?: string;
    }
  | {
      success: true;
      provider: "apple";
      identityToken: string;
      authorizationCode: string | null;
      user: string;
      email: string | null;
      fullName: NativeAppleFullName | null;
      state: string | null;
    };

export type NativeBridge = {
  getAppToken: () => Promise<AppTokenResult>;
  openCamera: () => Promise<NativeCameraResult>;
  pickImages: (input: {
    selectionLimit: number;
  }) => Promise<NativeImagePickerResult>;
  getPushToken: () => Promise<PushTokenResult>;
  openNotificationSettings: () => Promise<NotificationSettingsResult>;
  openAppSettings: () => Promise<AppSettingsResult>;
  getAppInfo: () => Promise<NativeAppInfoResult>;
  openExternalUrl: (input: { url: string }) => Promise<NativeOpenUrlResult>;
  shareContent: (
    input: NativeShareContentInput,
  ) => Promise<NativeShareContentResult>;
  shareFile: (input: NativeShareFileInput) => Promise<NativeShareContentResult>;
  saveFile: (input: NativeShareFileInput) => Promise<NativeSaveFileResult>;
  shareImageAsPdf: (
    input: NativeShareImageAsPdfInput,
  ) => Promise<NativeShareContentResult>;
  getCurrentLocation: (
    input?: NativeLocationInput,
  ) => Promise<NativeLocationResult>;
  loginWithKakao: () => Promise<NativeSocialLoginResult>;
  loginWithNaver: () => Promise<NativeSocialLoginResult>;
  loginWithApple: (
    input: NativeAppleLoginInput,
  ) => Promise<NativeAppleLoginResult>;
};

export type AppBridge = BridgeStore<NativeBridge>;
