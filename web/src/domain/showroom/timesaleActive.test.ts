import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ShowroomCoupon } from "./types";
import {
  isActiveTimesaleCoupon,
  selectActiveTimesaleCoupons,
} from "./timesaleActive";

const now = new Date("2026-11-17T05:00:00.000Z");

const baseTimesale: ShowroomCoupon = {
  id: "coupon-1",
  baristaId: "barista-1",
  showroomId: "showroom-1",
  title: "오후 타임세일",
  discountDetail: "아메리카노 50% 할인",
  couponType: "timesale",
  validFrom: "2026-11-17T04:00:00.000Z",
  validUntil: "2026-11-17T08:00:00.000Z",
  totalLimit: 10,
  issuedCount: 3,
  createdAt: "2026-11-17T03:00:00.000Z",
  updatedAt: "2026-11-17T03:00:00.000Z",
};

describe("timesaleActive", () => {
  it("returns true for in-period timesale coupon with remaining quantity", () => {
    assert.equal(isActiveTimesaleCoupon(baseTimesale, now), true);
  });

  it("returns false for regular coupons, expired, not-yet-started, stopped, or sold-out timesales", () => {
    assert.equal(
      isActiveTimesaleCoupon({ ...baseTimesale, couponType: "regular" }, now),
      false,
    );
    assert.equal(
      isActiveTimesaleCoupon(
        { ...baseTimesale, validFrom: "2026-11-17T06:00:00.000Z" },
        now,
      ),
      false,
    );
    assert.equal(
      isActiveTimesaleCoupon(
        { ...baseTimesale, validUntil: "2026-11-17T05:00:00.000Z" },
        now,
      ),
      false,
    );
    assert.equal(
      isActiveTimesaleCoupon({ ...baseTimesale, issuedCount: 10 }, now),
      false,
    );
    assert.equal(
      isActiveTimesaleCoupon(
        { ...baseTimesale, issuanceStoppedAt: "2026-11-17T04:30:00.000Z" },
        now,
      ),
      false,
    );
  });

  it("filters only active timesale coupons from a list", () => {
    const list = selectActiveTimesaleCoupons(
      [
        baseTimesale,
        { ...baseTimesale, id: "coupon-2", couponType: "regular" },
        { ...baseTimesale, id: "coupon-3", issuedCount: 10 },
      ],
      now,
    );
    assert.deepEqual(
      list.map((c) => c.id),
      ["coupon-1"],
    );
  });
});
