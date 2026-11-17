import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canReceiveDirectMessage,
  canSendMapMessage,
  hasAdminRole,
} from "./authRole";

describe("hasAdminRole", () => {
  it("treats only admin role users as admins", () => {
    assert.equal(hasAdminRole({ role: "admin" }), true);
    assert.equal(hasAdminRole({ role: "barista" }), false);
    assert.equal(hasAdminRole({ role: "partner" }), false);
    assert.equal(hasAdminRole({ role: "enthusiast" }), false);
    assert.equal(hasAdminRole(null), false);
  });
});

describe("canSendMapMessage", () => {
  it("allows admin, barista, and partner users to send map messages", () => {
    assert.equal(canSendMapMessage({ role: "admin" }), true);
    assert.equal(canSendMapMessage({ role: "barista" }), true);
    assert.equal(canSendMapMessage({ role: "partner" }), true);
  });

  it("does not allow enthusiasts or guests to send map messages", () => {
    assert.equal(canSendMapMessage({ role: "enthusiast" }), false);
    assert.equal(canSendMapMessage(null), false);
  });
});

describe("canReceiveDirectMessage", () => {
  it("allows admin, barista, and partner users to receive replies", () => {
    assert.equal(canReceiveDirectMessage({ role: "admin" }), true);
    assert.equal(canReceiveDirectMessage({ role: "barista" }), true);
    assert.equal(canReceiveDirectMessage({ role: "partner" }), true);
  });

  it("does not allow enthusiasts or missing users to receive direct messages", () => {
    assert.equal(canReceiveDirectMessage({ role: "enthusiast" }), false);
    assert.equal(canReceiveDirectMessage(null), false);
  });
});
