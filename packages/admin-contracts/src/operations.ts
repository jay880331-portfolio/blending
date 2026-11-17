export type PlatformVersionPolicy = {
  latestBuildNumber: number | null;
  minBuildNumber: number | null;
  updateUrl: string | null;
};

export type AppVersionPolicy = {
  revision: number;
  enabled: boolean;
  message: string;
  android: PlatformVersionPolicy;
  ios: PlatformVersionPolicy;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type AppVersionPolicyUpdate = Omit<
  AppVersionPolicy,
  "revision" | "updatedAt" | "updatedBy"
> & { expectedRevision: number };

export type PublicAppVersionPolicy = Pick<
  AppVersionPolicy,
  "enabled" | "message" | "android" | "ios"
>;

export type OperationPolicy = {
  revision: number;
  signupEnabled: boolean;
  communityWriteEnabled: boolean;
  partnerWriteEnabled: boolean;
  reportingEnabled: boolean;
  maintenanceMessage: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type PublicOperationPolicy = Omit<
  OperationPolicy,
  "revision" | "updatedAt" | "updatedBy"
>;

export type OperationPolicyUpdate = Omit<
  OperationPolicy,
  "revision" | "updatedAt" | "updatedBy"
> & { expectedRevision: number };

export type SearchIndexRunTrigger = "admin" | "cron" | "script";
export type SearchIndexRunStatus = "running" | "succeeded" | "failed";

export type SearchIndexRunDto = {
  id: string;
  trigger: SearchIndexRunTrigger;
  status: SearchIndexRunStatus;
  indexedCount: number;
  deletedCount: number;
  durationMs: number;
  startedAt: string;
  completedAt: string | null;
  errorCode?: "RECONCILE_FAILED" | "LEASE_EXPIRED";
};

export type SearchIndexHealthDto = {
  checkedAt: string;
  byType: {
    type: string;
    sourceCount: number;
    indexedCount: number;
    missingCount: number;
    orphanCount: number;
  }[];
  latestRun: SearchIndexRunDto | null;
};
