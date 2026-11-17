import type {
  OperationPolicy,
  PublicOperationPolicy,
} from "@blending/admin-contracts";
import { adminSettingsMongoRepository } from "@/infrastructure/mongodb/adminSettingsMongoRepository";

export type OperationSwitch = keyof Pick<
  OperationPolicy,
  | "signupEnabled"
  | "communityWriteEnabled"
  | "partnerWriteEnabled"
  | "reportingEnabled"
>;

export class OperationDisabledError extends Error {
  status = 503 as const;
}

export async function requireOperationEnabled(
  feature: OperationSwitch,
  load = () => adminSettingsMongoRepository.getOperationPolicy(),
) {
  const policy = await load();
  if (!policy[feature])
    throw new OperationDisabledError(
      policy.maintenanceMessage ?? "서비스 운영이 일시 중단되었습니다.",
    );
}

export function toPublicOperationPolicy(
  policy: OperationPolicy,
): PublicOperationPolicy {
  return {
    signupEnabled: policy.signupEnabled,
    communityWriteEnabled: policy.communityWriteEnabled,
    partnerWriteEnabled: policy.partnerWriteEnabled,
    reportingEnabled: policy.reportingEnabled,
    maintenanceMessage: policy.maintenanceMessage,
  };
}

export function operationDisabledResponse(error: unknown) {
  if (!(error instanceof OperationDisabledError)) return null;
  return Response.json({ message: error.message }, { status: 503 });
}

export async function operationGuardResponse(feature: OperationSwitch) {
  try {
    await requireOperationEnabled(feature);
    return null;
  } catch (error) {
    const response = operationDisabledResponse(error);
    if (response) return response;
    throw error;
  }
}

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function operationSwitchForPublicMutation(
  method: string,
  pathname: string,
): OperationSwitch | null {
  if (!MUTATION_METHODS.has(method.toUpperCase())) return null;
  if (pathname.startsWith("/api/community/")) return "communityWriteEnabled";
  if (pathname.startsWith("/api/partner/")) return "partnerWriteEnabled";
  return null;
}
