import type {
  AppVersionPolicy,
  AppVersionPolicyUpdate,
  OperationPolicy,
  OperationPolicyUpdate,
  PlatformVersionPolicy,
} from "@blending/admin-contracts";
import type { ClientSession, Db } from "mongodb";
import { SettingsConflictError } from "@/application/admin/appSettingsUseCases";
import { getMongoDb } from "./client";

const VERSION_KEY = "mobile_version_policy";
const OPERATION_KEY = "operation_policy";
const defaultPlatform = {
  latestBuildNumber: null,
  minBuildNumber: null,
  updateUrl: null,
};

export const defaultAppVersionPolicy: AppVersionPolicy = {
  revision: 0,
  enabled: false,
  message: "안정적인 서비스 이용을 위해 최신 버전으로 업데이트해 주세요.",
  android: defaultPlatform,
  ios: defaultPlatform,
  updatedAt: null,
  updatedBy: null,
};

export const defaultOperationPolicy: OperationPolicy = {
  revision: 0,
  signupEnabled: true,
  communityWriteEnabled: true,
  partnerWriteEnabled: true,
  reportingEnabled: true,
  maintenanceMessage: null,
  updatedAt: null,
  updatedBy: null,
};

type ConfigDocument = {
  key: string;
  revision?: number;
  enabled?: boolean;
  message?: string;
  android?: PlatformVersionPolicy;
  ios?: PlatformVersionPolicy;
  signupEnabled?: boolean;
  communityWriteEnabled?: boolean;
  partnerWriteEnabled?: boolean;
  reportingEnabled?: boolean;
  maintenanceMessage?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
};

type SettingsUpdate = AppVersionPolicyUpdate | OperationPolicyUpdate;

export class AdminSettingsMongoRepository {
  constructor(private readonly getDb: () => Promise<Db> = getMongoDb) {}

  private async read<T>(key: string, fallback: T): Promise<T> {
    const document = await (await this.getDb())
      .collection<ConfigDocument>("app_configs")
      .findOne({ key }, { projection: { _id: 0, key: 0 } });
    return document ? (document as T) : fallback;
  }

  getAppVersionPolicy() {
    return this.read(VERSION_KEY, defaultAppVersionPolicy);
  }

  getOperationPolicy() {
    return this.read(OPERATION_KEY, defaultOperationPolicy);
  }

  async updateAppVersionPolicy(
    input: AppVersionPolicyUpdate,
    actor: string,
    session: ClientSession,
  ) {
    return this.update<AppVersionPolicy>(VERSION_KEY, input, actor, session);
  }

  async updateOperationPolicy(
    input: OperationPolicyUpdate,
    actor: string,
    session: ClientSession,
  ) {
    return this.update<OperationPolicy>(OPERATION_KEY, input, actor, session);
  }

  private async update<T>(
    key: string,
    input: SettingsUpdate,
    actor: string,
    session: ClientSession,
  ): Promise<T> {
    const { expectedRevision, ...values } = input;
    const collection = (await this.getDb()).collection<ConfigDocument>(
      "app_configs",
    );
    const updatedAt = new Date().toISOString();
    const setValues: Partial<ConfigDocument> = {
      ...values,
      updatedAt,
      updatedBy: actor,
    };
    try {
      if (expectedRevision === 0)
        await collection.updateOne(
          { key, revision: { $exists: false } },
          { $set: { revision: 0 } },
          { session },
        );
      const result = await collection.findOneAndUpdate(
        { key, revision: expectedRevision },
        {
          $set: setValues,
          $inc: { revision: 1 },
          ...(expectedRevision === 0 ? { $setOnInsert: { key } } : {}),
        },
        {
          session,
          upsert: expectedRevision === 0,
          returnDocument: "after",
          projection: { _id: 0, key: 0 },
        },
      );
      if (!result) throw new SettingsConflictError();
      return result as T;
    } catch (error) {
      if (
        error instanceof SettingsConflictError ||
        (error as { code?: number }).code === 11000
      )
        throw new SettingsConflictError();
      throw error;
    }
  }
}

export const adminSettingsMongoRepository = new AdminSettingsMongoRepository();
