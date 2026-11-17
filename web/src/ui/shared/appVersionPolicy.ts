import type {
  AppVersionPolicy,
  PlatformVersionPolicy,
} from "@blending/admin-contracts";

export type MobilePlatform = "android" | "ios";
export type MobileVersionPolicy = Pick<
  AppVersionPolicy,
  "enabled" | "message" | "android" | "ios"
>;
export type { PlatformVersionPolicy };

export type NativeAppVersionInfo = {
  buildNumber: number | null;
  platform: "android" | "ios" | "web" | "unknown";
};

export type VersionPolicyDecision =
  | {
      action: "none";
    }
  | {
      action: "optional-update" | "force-update";
      message: string;
      updateUrl: string | null;
    };

export function evaluateVersionPolicy(
  appInfo: NativeAppVersionInfo,
  policy: MobileVersionPolicy,
): VersionPolicyDecision {
  if (!policy.enabled) return { action: "none" };
  if (appInfo.platform !== "android" && appInfo.platform !== "ios") {
    return { action: "none" };
  }
  if (appInfo.buildNumber === null) return { action: "none" };

  const platformPolicy = policy[appInfo.platform];

  if (
    platformPolicy.minBuildNumber !== null &&
    appInfo.buildNumber < platformPolicy.minBuildNumber
  ) {
    return {
      action: "force-update",
      message: policy.message,
      updateUrl: platformPolicy.updateUrl,
    };
  }

  if (
    platformPolicy.latestBuildNumber !== null &&
    appInfo.buildNumber < platformPolicy.latestBuildNumber
  ) {
    return {
      action: "optional-update",
      message: policy.message,
      updateUrl: platformPolicy.updateUrl,
    };
  }

  return { action: "none" };
}
