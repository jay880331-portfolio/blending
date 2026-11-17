import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { UserCoupon, ShowroomCoupon } from "./types";
import {
  isCouponExpired,
  resolveUserCouponStatus,
  decideCouponUseRequest,
  isEligibleForNewApprovalWindow,
  decideCouponApproval,
  decideCouponReject,
  isLiveOwnerCouponRequest,
  userCouponListPlacement,
  normalizeCouponUsageScope,
  parseCouponUsageScope,
  couponUsageScopeLabel,
  decideRedemptionShowroom,
} from "./couponStatus";

describe("UserCoupon status transitions", () => {
  it("determines EXPIRED when validUntil date has passed", () => {
    const expiredCoupon: ShowroomCoupon = {
      id: "c-1",
      baristaId: "b-1",
      showroomId: "s-1",
      title: "만료된 쿠폰",
      discountDetail: "500원 할인",
      validUntil: new Date(Date.now() - 3600 * 1000).toISOString(),
      couponType: "regular",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };

    const userCoupon: UserCoupon = {
      id: "uc-1",
      userId: "u-1",
      couponId: "c-1",
      status: "ISSUED",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      coupon: expiredCoupon,
    };

    const isExpired =
      userCoupon.status === "ISSUED" &&
      new Date(expiredCoupon.validUntil).getTime() < Date.now();

    assert.equal(isExpired, true);
  });

  it("marks status as USED when coupon is consumed at the cafe", () => {
    const now = new Date().toISOString();
    const userCoupon: UserCoupon = {
      id: "uc-1",
      userId: "u-1",
      couponId: "c-1",
      status: "ISSUED",
      usedAt: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };

    const consumed: UserCoupon = {
      ...userCoupon,
      status: "USED",
      usedAt: now,
      updatedAt: now,
    };

    assert.equal(consumed.status, "USED");
    assert.equal(consumed.usedAt, now);
  });

  it("constructs correct timesale deeplink href", () => {
    const showroomId = "showroom-st-123";
    const couponId = "coupon-ts-456";
    const deeplink = `/showroom/${showroomId}?coupon=${couponId}`;

    assert.equal(deeplink, "/showroom/showroom-st-123?coupon=coupon-ts-456");
  });

  it("derives status via resolveUserCouponStatus correctly", () => {
    const NOW = new Date("2026-09-13T12:00:00.000Z");
    const past = "2026-09-12T00:00:00.000Z";
    const future = "2026-10-13T00:00:00.000Z";

    assert.equal(isCouponExpired(past, NOW), true);
    assert.equal(isCouponExpired(future, NOW), false);
    assert.equal(resolveUserCouponStatus("ISSUED", future, NOW), "ISSUED");
    assert.equal(resolveUserCouponStatus("ISSUED", past, NOW), "EXPIRED");
    assert.equal(resolveUserCouponStatus("ISSUED", undefined, NOW), "ISSUED");
    assert.equal(
      resolveUserCouponStatus("REQUESTED", future, NOW, future),
      "REQUESTED",
    );
    assert.equal(
      resolveUserCouponStatus("REQUESTED", future, NOW, past),
      "ISSUED",
    );
    assert.equal(
      resolveUserCouponStatus("REQUESTED", undefined, NOW, future),
      "REQUESTED",
    );
    assert.equal(
      resolveUserCouponStatus("REQUESTED", past, NOW, future),
      "EXPIRED",
    );
    assert.equal(resolveUserCouponStatus("USED", past, NOW, future), "USED");
    assert.equal(
      resolveUserCouponStatus("EXPIRED", future, NOW, future),
      "EXPIRED",
    );
    assert.equal(
      resolveUserCouponStatus("REQUESTED", future, NOW, null),
      "ISSUED",
    );
    assert.equal(
      resolveUserCouponStatus("REQUESTED", future, NOW, ""),
      "ISSUED",
    );
  });

  it("decides coupon use request and eligibility for new approval window", () => {
    const NOW = new Date("2026-09-13T12:00:00.000Z");
    const past = "2026-09-12T00:00:00.000Z";
    const future = "2026-10-13T00:00:00.000Z";
    const newWindowEnd = "2026-09-13T12:03:00.000Z";

    assert.deepEqual(decideCouponUseRequest("ISSUED", future, undefined, NOW), {
      kind: "request",
      approvalExpiresAt: newWindowEnd,
    });
    assert.deepEqual(
      decideCouponUseRequest("ISSUED", undefined, undefined, NOW),
      {
        kind: "request",
        approvalExpiresAt: newWindowEnd,
      },
    );
    assert.deepEqual(decideCouponUseRequest("ISSUED", past, undefined, NOW), {
      kind: "reject",
    });
    assert.deepEqual(decideCouponUseRequest("REQUESTED", future, future, NOW), {
      kind: "same",
    });
    assert.deepEqual(decideCouponUseRequest("REQUESTED", future, past, NOW), {
      kind: "request",
      approvalExpiresAt: newWindowEnd,
    });
    assert.deepEqual(decideCouponUseRequest("REQUESTED", future, null, NOW), {
      kind: "request",
      approvalExpiresAt: newWindowEnd,
    });
    assert.deepEqual(decideCouponUseRequest("REQUESTED", future, "", NOW), {
      kind: "request",
      approvalExpiresAt: newWindowEnd,
    });
    assert.deepEqual(
      decideCouponUseRequest("REQUESTED", future, NOW.toISOString(), NOW),
      {
        kind: "request",
        approvalExpiresAt: newWindowEnd,
      },
    );
    assert.deepEqual(
      decideCouponUseRequest("REQUESTED", future, "not-a-date", NOW),
      {
        kind: "request",
        approvalExpiresAt: newWindowEnd,
      },
    );
    assert.deepEqual(decideCouponUseRequest("REQUESTED", past, future, NOW), {
      kind: "reject",
    });
    assert.deepEqual(decideCouponUseRequest("USED", past, undefined, NOW), {
      kind: "used",
    });
    assert.deepEqual(
      decideCouponUseRequest("EXPIRED", future, undefined, NOW),
      {
        kind: "reject",
      },
    );

    assert.equal(
      isEligibleForNewApprovalWindow("ISSUED", undefined, NOW),
      true,
    );
    assert.equal(
      isEligibleForNewApprovalWindow("REQUESTED", future, NOW),
      false,
    );
    assert.equal(isEligibleForNewApprovalWindow("REQUESTED", past, NOW), true);
    assert.equal(isEligibleForNewApprovalWindow("REQUESTED", null, NOW), true);
    assert.equal(isEligibleForNewApprovalWindow("REQUESTED", "", NOW), true);
    assert.equal(
      isEligibleForNewApprovalWindow("REQUESTED", "not-a-date", NOW),
      true,
    );
    assert.equal(
      isEligibleForNewApprovalWindow("REQUESTED", NOW.toISOString(), NOW),
      true,
    );
    assert.equal(isEligibleForNewApprovalWindow("USED", undefined, NOW), false);
    assert.equal(
      isEligibleForNewApprovalWindow("EXPIRED", undefined, NOW),
      false,
    );
  });

  it("decides coupon approval, reject, and live owner coupon request", () => {
    const NOW = new Date("2026-09-13T12:00:00.000Z");
    const past = "2026-09-12T00:00:00.000Z";
    const future = "2026-10-13T00:00:00.000Z";
    const windowEnd = "2026-09-13T12:03:00.000Z";

    // decideCouponApproval
    // - Live REQUESTED + future or missing validUntil approves with usedAt === NOW.toISOString().
    assert.deepEqual(
      decideCouponApproval("REQUESTED", future, windowEnd, NOW),
      {
        kind: "approve",
        usedAt: NOW.toISOString(),
      },
    );
    assert.deepEqual(
      decideCouponApproval("REQUESTED", undefined, windowEnd, NOW),
      {
        kind: "approve",
        usedAt: NOW.toISOString(),
      },
    );
    // - Dead window, null, "", NOW.toISOString(), "not-a-date", past validUntil, stored EXPIRED, and ISSUED approve as conflict.
    assert.deepEqual(decideCouponApproval("REQUESTED", future, past, NOW), {
      kind: "conflict",
    });
    assert.deepEqual(decideCouponApproval("REQUESTED", future, null, NOW), {
      kind: "conflict",
    });
    assert.deepEqual(decideCouponApproval("REQUESTED", future, "", NOW), {
      kind: "conflict",
    });
    assert.deepEqual(
      decideCouponApproval("REQUESTED", future, NOW.toISOString(), NOW),
      {
        kind: "conflict",
      },
    );
    assert.deepEqual(
      decideCouponApproval("REQUESTED", future, "not-a-date", NOW),
      {
        kind: "conflict",
      },
    );
    assert.deepEqual(decideCouponApproval("REQUESTED", past, windowEnd, NOW), {
      kind: "conflict",
    });
    assert.deepEqual(decideCouponApproval("EXPIRED", future, windowEnd, NOW), {
      kind: "conflict",
    });
    assert.deepEqual(decideCouponApproval("ISSUED", future, windowEnd, NOW), {
      kind: "conflict",
    });
    // - Stored USED approves as already_used.
    assert.deepEqual(decideCouponApproval("USED", future, windowEnd, NOW), {
      kind: "already_used",
    });
    assert.deepEqual(decideCouponApproval("USED", past, windowEnd, NOW), {
      kind: "already_used",
    });

    // decideCouponReject
    // - Stored REQUESTED rejects as revert for a live window, a past window, a past validUntil, and a null window.
    assert.deepEqual(decideCouponReject("REQUESTED", future, windowEnd, NOW), {
      kind: "revert",
    });
    assert.deepEqual(decideCouponReject("REQUESTED", future, past, NOW), {
      kind: "revert",
    });
    assert.deepEqual(decideCouponReject("REQUESTED", past, windowEnd, NOW), {
      kind: "revert",
    });
    assert.deepEqual(decideCouponReject("REQUESTED", future, null, NOW), {
      kind: "revert",
    });
    // - Stored ISSUED rejects as already_issued.
    assert.deepEqual(decideCouponReject("ISSUED", future, windowEnd, NOW), {
      kind: "already_issued",
    });
    // - Stored USED and stored EXPIRED reject as conflict.
    assert.deepEqual(decideCouponReject("USED", future, windowEnd, NOW), {
      kind: "conflict",
    });
    assert.deepEqual(decideCouponReject("EXPIRED", future, windowEnd, NOW), {
      kind: "conflict",
    });

    // isLiveOwnerCouponRequest
    // - isLiveOwnerCouponRequest is true for live REQUESTED with future or missing validUntil, and false for a past window, a past validUntil, ISSUED, and USED.
    assert.equal(
      isLiveOwnerCouponRequest("REQUESTED", future, windowEnd, NOW),
      true,
    );
    assert.equal(
      isLiveOwnerCouponRequest("REQUESTED", undefined, windowEnd, NOW),
      true,
    );
    assert.equal(
      isLiveOwnerCouponRequest("REQUESTED", future, past, NOW),
      false,
    );
    assert.equal(
      isLiveOwnerCouponRequest("REQUESTED", past, windowEnd, NOW),
      false,
    );
    assert.equal(
      isLiveOwnerCouponRequest("REQUESTED", future, NOW.toISOString(), NOW),
      false,
    );
    assert.equal(
      isLiveOwnerCouponRequest("ISSUED", future, windowEnd, NOW),
      false,
    );
    assert.equal(
      isLiveOwnerCouponRequest("USED", future, windowEnd, NOW),
      false,
    );
  });

  it("places user coupons into available or history correctly", () => {
    const NOW = new Date("2026-09-13T12:00:00.000Z");
    const past = "2026-09-12T00:00:00.000Z";
    const future = "2026-10-13T00:00:00.000Z";
    const windowEnd = "2026-09-13T12:03:00.000Z";
    const nan = "not-a-date";

    assert.equal(
      userCouponListPlacement("ISSUED", future, null, NOW),
      "available",
    );
    assert.equal(
      userCouponListPlacement("ISSUED", undefined, null, NOW),
      "available",
    );
    assert.equal(
      userCouponListPlacement("REQUESTED", future, windowEnd, NOW),
      "available",
    );
    assert.equal(
      userCouponListPlacement("REQUESTED", undefined, windowEnd, NOW),
      "available",
    );
    assert.equal(
      userCouponListPlacement("REQUESTED", future, NOW.toISOString(), NOW),
      "available",
    );
    assert.equal(
      userCouponListPlacement("REQUESTED", future, null, NOW),
      "available",
    );
    assert.equal(
      userCouponListPlacement("REQUESTED", future, "", NOW),
      "available",
    );
    assert.equal(
      userCouponListPlacement("REQUESTED", future, nan, NOW),
      "available",
    );
    assert.equal(
      userCouponListPlacement("REQUESTED", future, past, NOW),
      "available",
    );
    assert.equal(userCouponListPlacement("USED", past, null, NOW), "history");
    assert.equal(
      userCouponListPlacement("USED", future, windowEnd, NOW),
      "history",
    );
    assert.equal(
      userCouponListPlacement("EXPIRED", future, null, NOW),
      "history",
    );
    assert.equal(userCouponListPlacement("ISSUED", past, null, NOW), "history");
    assert.equal(
      userCouponListPlacement("REQUESTED", past, windowEnd, NOW),
      "history",
    );
  });

  it("decides the three coupon usage scopes", () => {
    assert.equal(normalizeCouponUsageScope(undefined), "own");
    assert.equal(normalizeCouponUsageScope("nope"), "own");
    assert.equal(normalizeCouponUsageScope("designated"), "designated");
    assert.equal(normalizeCouponUsageScope("joined"), "joined");

    assert.equal(parseCouponUsageScope("nope"), null);
    assert.equal(parseCouponUsageScope(""), "own");
    assert.equal(parseCouponUsageScope(null), "own");
    assert.equal(parseCouponUsageScope(undefined), "own");
    assert.equal(parseCouponUsageScope("own"), "own");

    assert.deepEqual(
      decideRedemptionShowroom({
        usageScope: "own",
        issuerShowroomId: "issuer",
        requestedShowroomId: "spoof",
        joinedShowroomIds: [],
      }),
      { ok: true, showroomId: "issuer" },
    );
    assert.deepEqual(
      decideRedemptionShowroom({
        usageScope: "own",
        issuerShowroomId: "",
        joinedShowroomIds: [],
      }),
      { ok: false },
    );
    assert.deepEqual(
      decideRedemptionShowroom({
        usageScope: "designated",
        issuerShowroomId: "issuer",
        designatedShowroomId: "other",
        requestedShowroomId: "spoof",
        joinedShowroomIds: ["spoof"],
      }),
      { ok: true, showroomId: "other" },
    );
    assert.deepEqual(
      decideRedemptionShowroom({
        usageScope: "designated",
        issuerShowroomId: "issuer",
        designatedShowroomId: "   ",
        joinedShowroomIds: [],
      }),
      { ok: false },
    );
    assert.deepEqual(
      decideRedemptionShowroom({
        usageScope: "joined",
        issuerShowroomId: "issuer",
        requestedShowroomId: "cafe-a",
        joinedShowroomIds: ["cafe-a", "cafe-b"],
      }),
      { ok: true, showroomId: "cafe-a" },
    );
    assert.deepEqual(
      decideRedemptionShowroom({
        usageScope: "joined",
        issuerShowroomId: "issuer",
        requestedShowroomId: "cafe-z",
        joinedShowroomIds: ["cafe-a"],
      }),
      { ok: false },
    );

    assert.equal(couponUsageScopeLabel("own"), "내 카페");
    assert.equal(couponUsageScopeLabel("designated"), "지정 카페");
    assert.equal(couponUsageScopeLabel("joined"), "가입 카페");
  });

  it("keeps couponStatus importable from the client bundle", () => {
    const source = readFileSync(
      new URL("./couponStatus.ts", import.meta.url),
      "utf8",
    );
    assert.equal(source.includes("node:module"), false);
    assert.equal(source.includes("node:test"), false);
    assert.equal(source.includes("node:assert"), false);
    assert.equal(source.includes("NODE_TEST_CONTEXT"), false);
  });
});
