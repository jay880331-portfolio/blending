import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClientSession, Db } from "mongodb";
import { AdminSettingsMongoRepository } from "@/infrastructure/mongodb/adminSettingsMongoRepository";
import { versionPolicyUpdate } from "../../../scripts/update-mobile-version-policy";
import {
  SettingsConflictError,
  validateAppVersionPolicyUpdate,
} from "./appSettingsUseCases";

describe("app settings", () => {
  it("rejects a minimum build greater than latest build", () => {
    assert.throws(
      () =>
        validateAppVersionPolicyUpdate({
          expectedRevision: 1,
          enabled: true,
          message: "업데이트",
          android: {
            latestBuildNumber: 10,
            minBuildNumber: 11,
            updateUrl: null,
          },
          ios: {
            latestBuildNumber: null,
            minBuildNumber: null,
            updateUrl: null,
          },
        }),
      /최소 빌드/,
    );
  });

  it("rejects invalid build numbers and update URLs", () => {
    const base = {
      expectedRevision: 0,
      enabled: true,
      message: "업데이트",
      ios: {
        latestBuildNumber: null,
        minBuildNumber: null,
        updateUrl: null,
      },
    };
    assert.throws(() =>
      validateAppVersionPolicyUpdate({
        ...base,
        android: {
          latestBuildNumber: 1.5,
          minBuildNumber: null,
          updateUrl: null,
        },
      }),
    );
    assert.throws(() =>
      validateAppVersionPolicyUpdate({
        ...base,
        android: {
          latestBuildNumber: 1,
          minBuildNumber: 1,
          updateUrl: "javascript:alert(1)",
        },
      }),
    );
  });

  it("represents stale revisions as HTTP conflicts", () => {
    assert.equal(new SettingsConflictError().status, 409);
  });

  it("uses the expected revision and rejects stale writes", async () => {
    let filter: unknown;
    const repository = new AdminSettingsMongoRepository(
      async () =>
        ({
          collection: () => ({
            findOneAndUpdate: async (nextFilter: unknown) => {
              filter = nextFilter;
              return null;
            },
          }),
        }) as unknown as Db,
    );
    await assert.rejects(
      () =>
        repository.updateOperationPolicy(
          {
            expectedRevision: 2,
            signupEnabled: true,
            communityWriteEnabled: true,
            partnerWriteEnabled: true,
            reportingEnabled: true,
            maintenanceMessage: null,
          },
          "관리자",
          {} as ClientSession,
        ),
      SettingsConflictError,
    );
    assert.deepEqual(filter, { key: "operation_policy", revision: 2 });
  });

  it("keeps EAS build synchronization monotonic and increments revision", () => {
    const update = versionPolicyUpdate({ android: 42 });
    assert.deepEqual(update.$max, { "android.latestBuildNumber": 42 });
    assert.deepEqual(update.$inc, { revision: 1 });
  });
});
