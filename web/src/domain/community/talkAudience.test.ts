import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canWriteTalkAudience,
  defaultTalkAudienceForRole,
  resolveTalkAudience,
} from "./talkAudience";

describe("talkAudience", () => {
  it("defaults legacy posts without audience to barista", () => {
    assert.equal(resolveTalkAudience(undefined), "barista");
    assert.equal(resolveTalkAudience(null), "barista");
    assert.equal(resolveTalkAudience("barista"), "barista");
    assert.equal(resolveTalkAudience("enthusiast"), "enthusiast");
  });

  it("picks default audience by user role", () => {
    assert.equal(defaultTalkAudienceForRole("barista"), "barista");
    assert.equal(defaultTalkAudienceForRole("enthusiast"), "enthusiast");
    assert.equal(defaultTalkAudienceForRole("admin"), "enthusiast");
  });

  it("enforces role-based write access per talk audience", () => {
    assert.equal(canWriteTalkAudience("enthusiast", "enthusiast"), true);
    assert.equal(canWriteTalkAudience("enthusiast", "barista"), false);

    assert.equal(canWriteTalkAudience("barista", "barista"), true);
    assert.equal(canWriteTalkAudience("barista", "enthusiast"), false);

    assert.equal(canWriteTalkAudience("admin", "enthusiast"), true);
    assert.equal(canWriteTalkAudience("admin", "barista"), true);

    assert.equal(canWriteTalkAudience("partner", "enthusiast"), false);
    assert.equal(canWriteTalkAudience("partner", "barista"), false);
  });
});
