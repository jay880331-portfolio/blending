import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateVersionPolicy,
  type MobileVersionPolicy,
} from "./appVersionPolicy";
import { toPublicVersionPolicy } from "../../../app/api/app/version-policy/route";

const policy: MobileVersionPolicy = {
  enabled: true,
  message: "최신 버전으로 업데이트해 주세요.",
  android: {
    latestBuildNumber: 25,
    minBuildNumber: 23,
    updateUrl: "https://play.google.com/store/apps/details?id=com.blending.app",
  },
  ios: {
    latestBuildNumber: 8,
    minBuildNumber: 6,
    updateUrl: "https://testflight.apple.com/join/example",
  },
};

describe("evaluateVersionPolicy", () => {
  it("forces updates below the minimum build number", () => {
    assert.deepEqual(
      evaluateVersionPolicy({ platform: "android", buildNumber: 22 }, policy),
      {
        action: "force-update",
        message: "최신 버전으로 업데이트해 주세요.",
        updateUrl:
          "https://play.google.com/store/apps/details?id=com.blending.app",
      },
    );
  });

  it("allows optional updates below the latest build number", () => {
    assert.equal(
      evaluateVersionPolicy({ platform: "ios", buildNumber: 7 }, policy).action,
      "optional-update",
    );
  });

  it("does nothing for current builds, disabled policies, and web", () => {
    assert.equal(
      evaluateVersionPolicy({ platform: "ios", buildNumber: 8 }, policy).action,
      "none",
    );
    assert.equal(
      evaluateVersionPolicy(
        { platform: "android", buildNumber: 1 },
        { ...policy, enabled: false },
      ).action,
      "none",
    );
    assert.equal(
      evaluateVersionPolicy({ platform: "web", buildNumber: 1 }, policy).action,
      "none",
    );
  });
});

it("does not expose Admin metadata in the public version policy", () => {
  const publicPolicy = toPublicVersionPolicy({
    enabled: true,
    message: "업데이트",
    revision: 9,
    updatedAt: "2026-07-11T00:00:00.000Z",
    updatedBy: "관리자",
  });
  assert.deepEqual(Object.keys(publicPolicy).sort(), [
    "android",
    "enabled",
    "ios",
    "message",
  ]);
});
