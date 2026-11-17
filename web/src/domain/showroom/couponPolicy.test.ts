import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { benefitLabel, canIssueCoupon, parseCouponDraft } from "./couponPolicy";

const draft = {
  title: "커피 산책",
  couponType: "timesale",
  usageScope: "SINGLE",
  storeId: "seoul",
  benefit: {
    kind: "PERCENT",
    value: 20,
    minimumOrder: 5000,
    maximumDiscount: 2000,
  },
  validFrom: "2026-10-20T00:00:00Z",
  validUntil: "2099-01-01T00:00:00Z",
  totalLimit: 100,
  perUserLimit: 1,
  conditions: "평일 오후",
  allowStacking: false,
  costBearer: "ISSUER",
};
describe("커스텀 쿠폰 입력 정책", () => {
  it("혜택을 구조화하고 날짜·표시 문구를 정규화한다", () => {
    const parsed = parseCouponDraft(draft);
    assert.equal(benefitLabel(parsed.benefit), "20% 할인");
    assert.equal(parsed.benefit.maximumDiscount, 2000);
    assert.equal(parsed.validFrom, "2026-10-20T00:00:00.000Z");
    assert.equal(
      benefitLabel(
        parseCouponDraft({
          ...draft,
          benefit: { kind: "ITEM", itemName: "라떼" },
        }).benefit,
      ),
      "라떼 1잔 제공",
    );
  });
  it("할인·기간·수량·범위·비용의 잘못된 입력을 거절한다", () => {
    for (const input of [
      null,
      [],
      { ...draft, title: " " },
      { ...draft, benefit: { kind: "PERCENT", value: 101 } },
      { ...draft, benefit: { kind: "AMOUNT", value: "1000" } },
      { ...draft, validUntil: "invalid" },
      { ...draft, validUntil: "2000-01-01" },
      { ...draft, totalLimit: 1.5 },
      { ...draft, perUserLimit: 0 },
      { ...draft, usageScope: "GROUP", allowedStoreIds: [] },
      { ...draft, usageScope: "ALL", costBearer: "REDEEMING_STORE" },
      { ...draft, allowStacking: "true" },
    ])
      assert.throws(() => parseCouponDraft(input));
  });
  it("예정·승인 대기·중단·수량 마감에는 발급할 수 없다", () => {
    const coupon = {
      ...parseCouponDraft(draft),
      id: "c",
      baristaId: "u",
      showroomId: "s",
      discountDetail: "20% 할인",
      policyVersion: 2 as const,
      approvalState: "ACTIVE" as const,
      createdAt: "",
      updatedAt: "",
    };
    assert.equal(canIssueCoupon(coupon, new Date("2027-01-01")), true);
    for (const updated of [
      { ...coupon, approvalState: "PENDING" as const },
      { ...coupon, issuanceStoppedAt: "now" },
      { ...coupon, issuedCount: 100 },
      { ...coupon, validFrom: "2098-01-01" },
    ])
      assert.equal(canIssueCoupon(updated, new Date("2027-01-01")), false);
  });
});
