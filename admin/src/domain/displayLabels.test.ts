import { strict as assert } from "node:assert";
import { it } from "node:test";
import {
  adminContentTypeLabel,
  adminRoleLabel,
  adminStatusLabel,
  adminSummaryLabel,
} from "./displayLabels";

it("maps known admin statuses", () => {
  assert.equal(adminStatusLabel("active"), "활성");
  assert.equal(adminStatusLabel("published"), "발행");
  assert.equal(adminStatusLabel("unknown"), "unknown");
});

it("maps roles, metrics, and content types", () => {
  assert.equal(adminRoleLabel("barista"), "바리스타");
  assert.equal(adminSummaryLabel("totalUsers"), "전체 사용자");
  assert.equal(adminContentTypeLabel("community_event"), "이벤트");
  assert.equal(adminContentTypeLabel("member_profile"), "인물사전");
});
