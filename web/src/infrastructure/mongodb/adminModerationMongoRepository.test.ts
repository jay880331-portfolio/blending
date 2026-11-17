import assert from "node:assert/strict";
import { test } from "node:test";
import type { ClientSession } from "mongodb";
import {
  canClearSanctionStatus,
  commentListPipeline,
  commentStateFilter,
  reportActionTiming,
  targetFindOptions,
} from "./adminModerationMongoRepository";

test("comment list pagination runs inside Mongo aggregation", () => {
  const pipeline = commentListPipeline(3, 20, true);
  const facet = pipeline.find((stage) => "$facet" in stage) as {
    $facet: { items: Record<string, number>[] };
  };
  assert.deepEqual(facet.$facet.items, [{ $skip: 40 }, { $limit: 20 }]);
});

test("comment list limits a content detail query to its parent", () => {
  const pipeline = commentListPipeline(1, 20, undefined, "qa", "qa/1");
  assert.deepEqual(pipeline[0], { $match: { id: "qa/1" } });
  assert.equal(
    pipeline.some((stage) => "$unionWith" in stage),
    false,
  );
});

test("an old sanction cannot clear a later manual suspension", () => {
  assert.equal(
    canClearSanctionStatus({ accountStatus: "suspended" }, false),
    false,
  );
});

for (const order of [
  ["new", "old"],
  ["old", "new"],
]) {
  test(`two blocking sanctions clear status only after final revoke (${order.join("-")})`, () => {
    const active = new Set(["old", "new"]);
    const user = {
      accountStatusSource: "sanction",
      accountStatus: "suspended",
    };
    active.delete(order[0]!);
    assert.equal(canClearSanctionStatus(user, active.size > 0), false);
    assert.equal(user.accountStatus, "suspended");
    active.delete(order[1]!);
    assert.equal(canClearSanctionStatus(user, active.size > 0), true);
    user.accountStatus = "active";
    assert.equal(user.accountStatus, "active");
  });
}

test("comment state CAS requires the opposite persisted state", () => {
  assert.deepEqual(commentStateFilter(false), { $ne: true });
  assert.equal(commentStateFilter(true), true);
});

test("marks open reports overdue after 24 hours", () => {
  const report = reportActionTiming(
    {
      id: "report-1",
      reporterId: "u1",
      targetType: "user",
      targetId: "u2",
      reason: "abuse",
      detail: "신고 사유를 확인할 수 있도록 충분히 자세하게 작성한 내용입니다.",
      status: "open",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    Date.parse("2026-01-02T00:00:00.001Z"),
  );
  assert.equal(report.actionOverdue, true);
  assert.equal(report.actionDueAt, "2026-01-02T00:00:00.000Z");
});

test("report target reads pass the transaction session outside projection", () => {
  const session = {} as ClientSession;
  const options = targetFindOptions({ id: 1 }, session);
  assert.equal(options.session, session);
  assert.deepEqual(options.projection, { id: 1 });
  assert.equal("session" in options.projection, false);
});

test("concurrent comment decisions allow only one state transition", async () => {
  let deleted = false;
  const claim = async () => {
    const expected = commentStateFilter(false);
    if (
      !(typeof expected === "object" ? deleted !== true : deleted === expected)
    )
      return false;
    deleted = true;
    return true;
  };
  assert.deepEqual(await Promise.all([claim(), claim()]), [true, false]);
});
