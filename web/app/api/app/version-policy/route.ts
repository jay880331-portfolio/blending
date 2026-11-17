import { getMongoDb } from "@/infrastructure/mongodb/client";
import type {
  PlatformVersionPolicy,
  PublicAppVersionPolicy,
} from "@blending/admin-contracts";

export const dynamic = "force-dynamic";

const POLICY_KEY = "mobile_version_policy";
const DEFAULT_MESSAGE =
  "안정적인 서비스 이용을 위해 최신 버전으로 업데이트해 주세요.";

type VersionPolicyDocument = {
  [key: string]: unknown;
  key?: string;
  enabled?: boolean;
  message?: string;
  android?: Partial<PlatformVersionPolicy>;
  ios?: Partial<PlatformVersionPolicy>;
};

const emptyPlatformPolicy: PlatformVersionPolicy = {
  latestBuildNumber: null,
  minBuildNumber: null,
  updateUrl: null,
};

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function platformPolicy(
  value: Partial<PlatformVersionPolicy> | undefined,
): PlatformVersionPolicy {
  if (!value) return emptyPlatformPolicy;

  return {
    latestBuildNumber: numberOrNull(value.latestBuildNumber),
    minBuildNumber: numberOrNull(value.minBuildNumber),
    updateUrl: stringOrNull(value.updateUrl),
  };
}

export function toPublicVersionPolicy(
  document: VersionPolicyDocument | null,
): PublicAppVersionPolicy {
  if (!document) {
    return {
      enabled: false,
      message: DEFAULT_MESSAGE,
      android: emptyPlatformPolicy,
      ios: emptyPlatformPolicy,
    };
  }

  return {
    enabled: document.enabled === true,
    message: stringOrNull(document.message) ?? DEFAULT_MESSAGE,
    android: platformPolicy(document.android),
    ios: platformPolicy(document.ios),
  };
}

export async function GET() {
  try {
    const db = await getMongoDb();
    const document = await db
      .collection<VersionPolicyDocument>("app_configs")
      .findOne({ key: POLICY_KEY });

    return Response.json(toPublicVersionPolicy(document), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[version-policy] Failed to load mobile version policy.", {
      message: error instanceof Error ? error.message : String(error),
    });

    return Response.json(toPublicVersionPolicy(null), {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
