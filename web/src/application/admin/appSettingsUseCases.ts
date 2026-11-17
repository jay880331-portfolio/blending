import type {
  AppVersionPolicyUpdate,
  OperationPolicyUpdate,
  PlatformVersionPolicy,
} from "@blending/admin-contracts";

export class SettingsInputError extends Error {
  status = 400 as const;
}

export class SettingsConflictError extends Error {
  status = 409 as const;
  constructor() {
    super(
      "설정이 다른 관리자에 의해 변경되었습니다. 새로고침 후 다시 시도해주세요.",
    );
  }
}

function revision(value: number) {
  if (!Number.isInteger(value) || value < 0)
    throw new SettingsInputError("revision을 확인해주세요.");
}

export function validateVersionPolicy(policy: PlatformVersionPolicy) {
  if (!policy || typeof policy !== "object")
    throw new SettingsInputError("플랫폼별 버전 정책을 확인해주세요.");
  for (const value of [policy.latestBuildNumber, policy.minBuildNumber]) {
    if (value !== null && (!Number.isInteger(value) || value <= 0))
      throw new SettingsInputError("빌드 번호는 양의 정수여야 합니다.");
  }
  if (
    policy.latestBuildNumber !== null &&
    policy.minBuildNumber !== null &&
    policy.minBuildNumber > policy.latestBuildNumber
  )
    throw new SettingsInputError("최소 빌드는 최신 빌드보다 클 수 없습니다.");
  if (policy.updateUrl !== null) {
    try {
      const url = new URL(policy.updateUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw null;
    } catch {
      throw new SettingsInputError(
        "업데이트 URL은 http 또는 https여야 합니다.",
      );
    }
  }
}

export function validateAppVersionPolicyUpdate(input: AppVersionPolicyUpdate) {
  if (!input || typeof input !== "object")
    throw new SettingsInputError("앱 버전 정책을 확인해주세요.");
  revision(input.expectedRevision);
  if (
    typeof input.enabled !== "boolean" ||
    typeof input.message !== "string" ||
    !input.message.trim()
  )
    throw new SettingsInputError("업데이트 메시지를 입력해주세요.");
  validateVersionPolicy(input.android);
  validateVersionPolicy(input.ios);
  return input;
}

export function validateOperationPolicyUpdate(input: OperationPolicyUpdate) {
  if (!input || typeof input !== "object")
    throw new SettingsInputError("운영 정책을 확인해주세요.");
  revision(input.expectedRevision);
  for (const key of [
    "signupEnabled",
    "communityWriteEnabled",
    "partnerWriteEnabled",
    "reportingEnabled",
  ] as const)
    if (typeof input[key] !== "boolean")
      throw new SettingsInputError("운영 스위치를 확인해주세요.");
  if (
    input.maintenanceMessage !== null &&
    typeof input.maintenanceMessage !== "string"
  )
    throw new SettingsInputError("운영 메시지를 확인해주세요.");
  return input;
}
