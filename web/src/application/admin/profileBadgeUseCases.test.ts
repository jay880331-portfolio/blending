import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ProfileBadgeInputError,
  parseAdminProfileBadgeInput,
  parseAssignAdminUserBadgeInput,
} from "./profileBadgeUseCases";

const valid = {
  name: "본부장",
  icon: "crown",
  imageUrl: null,
  sortOrder: 0,
};

describe("parseAdminProfileBadgeInput", () => {
  it("accepts a catalog badge and trims the name", () => {
    assert.deepEqual(
      parseAdminProfileBadgeInput({ ...valid, name: " 본부장 " }),
      valid,
    );
  });

  it("accepts an uploaded https image and an internal path", () => {
    assert.equal(
      parseAdminProfileBadgeInput({
        ...valid,
        imageUrl: "https://cdn.example.com/crown.png",
      }).imageUrl,
      "https://cdn.example.com/crown.png",
    );
    assert.equal(
      parseAdminProfileBadgeInput({
        ...valid,
        imageUrl: "/uploads/badges/crown.png",
      }).imageUrl,
      "/uploads/badges/crown.png",
    );
  });

  it("rejects an unsafe image url", () => {
    assert.throws(
      () =>
        parseAdminProfileBadgeInput({
          ...valid,
          imageUrl: "javascript:alert(1)",
        }),
      ProfileBadgeInputError,
    );
  });

  it("parses sort order from a numeric string", () => {
    assert.equal(
      parseAdminProfileBadgeInput({ ...valid, sortOrder: "3" }).sortOrder,
      3,
    );
  });

  it("rejects an empty name, unknown icon, and negative order", () => {
    assert.throws(
      () => parseAdminProfileBadgeInput({ ...valid, name: "  " }),
      ProfileBadgeInputError,
    );
    assert.throws(
      () => parseAdminProfileBadgeInput({ ...valid, icon: "gold" }),
      ProfileBadgeInputError,
    );
    assert.throws(
      () => parseAdminProfileBadgeInput({ ...valid, sortOrder: -1 }),
      ProfileBadgeInputError,
    );
  });

  it("rejects a name longer than 12 characters", () => {
    assert.throws(
      () => parseAdminProfileBadgeInput({ ...valid, name: "abcdefghijklm" }),
      ProfileBadgeInputError,
    );
  });
});

describe("parseAssignAdminUserBadgeInput", () => {
  it("requires a badge id and reason", () => {
    assert.deepEqual(
      parseAssignAdminUserBadgeInput({
        badgeId: "badge-1",
        reason: " 공식 부여 ",
      }),
      { badgeId: "badge-1", reason: "공식 부여" },
    );
    assert.throws(
      () => parseAssignAdminUserBadgeInput({ badgeId: "badge-1" }),
      ProfileBadgeInputError,
    );
  });
});
