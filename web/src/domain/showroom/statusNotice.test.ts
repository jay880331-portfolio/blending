import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STATUS_NOTICE_MAX_LENGTH,
  computeStatusNoticeExpiresAt,
  getActiveStatusNotice,
  hasActiveStatusNotice,
  validateStatusNoticeText,
} from "./statusNotice";

describe("statusNotice", () => {
  it("validates notice text up to 40 characters", () => {
    assert.deepEqual(validateStatusNoticeText("   "), {
      ok: false,
      error: "한줄공지 내용을 입력해주세요.",
    });

    const fortyChars = "가".repeat(STATUS_NOTICE_MAX_LENGTH);
    assert.deepEqual(validateStatusNoticeText(`  ${fortyChars}  `), {
      ok: true,
      text: fortyChars,
    });

    const fortyOneChars = "가".repeat(STATUS_NOTICE_MAX_LENGTH + 1);
    assert.equal(validateStatusNoticeText(fortyOneChars).ok, false);
  });

  it("computes expiry for 3h, 6h, and KST today_end", () => {
    // 2026-11-17 10:00:00 KST = 2026-11-17 01:00:00 UTC
    const morningUtc = new Date("2026-11-17T01:00:00.000Z");
    assert.equal(
      computeStatusNoticeExpiresAt("3h", morningUtc).toISOString(),
      "2026-11-17T04:00:00.000Z",
    );
    assert.equal(
      computeStatusNoticeExpiresAt("6h", morningUtc).toISOString(),
      "2026-11-17T07:00:00.000Z",
    );
    // 2026-11-17 23:59:59.999 KST = 2026-11-17 14:59:59.999 UTC
    assert.equal(
      computeStatusNoticeExpiresAt("today_end", morningUtc).toISOString(),
      "2026-11-17T14:59:59.999Z",
    );

    // 2026-11-18 00:10:00 KST = 2026-11-17 15:10:00 UTC -> next KST day end
    const afterMidnightKst = new Date("2026-11-17T15:10:00.000Z");
    assert.equal(
      computeStatusNoticeExpiresAt("today_end", afterMidnightKst).toISOString(),
      "2026-11-18T14:59:59.999Z",
    );
  });

  it("filters expired notices based on expiresAt > now and strips updatedBy", () => {
    const now = new Date("2026-11-17T10:00:00.000Z");
    const active = {
      text: "오늘 게이샤 드립 가능",
      createdAt: "2026-11-17T09:00:00.000Z",
      expiresAt: "2026-11-17T10:00:01.000Z",
      updatedBy: "user-1",
    };
    const expiredAtBoundary = {
      ...active,
      expiresAt: "2026-11-17T10:00:00.000Z",
    };
    const expiredPast = {
      ...active,
      expiresAt: "2026-11-17T09:59:59.000Z",
    };

    const result = getActiveStatusNotice(active, now);
    assert.deepEqual(result, {
      text: "오늘 게이샤 드립 가능",
      createdAt: "2026-11-17T09:00:00.000Z",
      expiresAt: "2026-11-17T10:00:01.000Z",
    });
    assert.equal(
      Object.prototype.hasOwnProperty.call(result, "updatedBy"),
      false,
    );
    assert.equal(hasActiveStatusNotice(active, now), true);
    assert.equal(getActiveStatusNotice(expiredAtBoundary, now), null);
    assert.equal(getActiveStatusNotice(expiredPast, now), null);
    assert.equal(hasActiveStatusNotice(null, now), false);
  });
});
