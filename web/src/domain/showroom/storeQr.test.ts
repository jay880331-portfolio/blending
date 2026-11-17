import assert from "node:assert/strict";
import test from "node:test";
import {
  couponAllowsStore,
  isStoreQr,
  parseStoreQr,
  storeQrUrl,
} from "./storeQr";
import type { ShowroomCoupon } from "./types";

const coupon: ShowroomCoupon = {
  id: "c",
  showroomId: "seoul",
  baristaId: "owner",
  title: "연합 쿠폰",
  discountDetail: "1,000원 할인",
  validUntil: "2099-12-31",
  couponType: "regular",
  createdAt: "",
  updatedAt: "",
};
const qr = { storeId: "busan", code: "a".repeat(43) };

test("매장 QR은 같은 서비스의 정해진 경로와 완전한 코드만 허용한다", () => {
  assert.deepEqual(
    parseStoreQr(
      storeQrUrl("https://blending.example", qr),
      "https://blending.example",
    ),
    qr,
  );
  for (const url of [
    "https://fake.example/showroom/coupons?store=busan&code=" + qr.code,
    "/showroom/coupons?store=busan",
    "/login?store=busan&code=" + qr.code,
    "javascript:alert(1)",
  ]) {
    assert.equal(parseStoreQr(url, "https://blending.example"), null);
  }
  assert.equal(isStoreQr({ storeId: { $ne: null }, code: qr.code }), false);
});

test("SINGLE·GROUP·ALL은 발행 매장과 별개로 사용처를 판단한다", () => {
  assert.equal(
    couponAllowsStore(
      { ...coupon, usageScope: "SINGLE", storeId: "busan" },
      "busan",
    ),
    true,
  );
  assert.equal(
    couponAllowsStore(
      { ...coupon, usageScope: "SINGLE", storeId: "busan" },
      "seoul",
    ),
    false,
  );
  assert.equal(
    couponAllowsStore(
      { ...coupon, usageScope: "GROUP", allowedStoreIds: ["seoul", "busan"] },
      "busan",
    ),
    true,
  );
  assert.equal(
    couponAllowsStore(
      { ...coupon, usageScope: "GROUP", allowedStoreIds: ["seoul", "busan"] },
      "jeju",
    ),
    false,
  );
  assert.equal(
    couponAllowsStore({ ...coupon, usageScope: "GROUP" }, "busan"),
    false,
  );
  assert.equal(
    couponAllowsStore({ ...coupon, usageScope: "ALL" }, "busan", []),
    true,
  );
});

test("기존 쿠폰의 사용처는 확대하지 않고 알 수 없는 정책은 거절한다", () => {
  assert.equal(couponAllowsStore(coupon, "busan"), false);
  assert.equal(
    couponAllowsStore(
      { ...coupon, usageScope: "designated", designatedShowroomId: "busan" },
      "busan",
    ),
    true,
  );
  assert.equal(
    couponAllowsStore({ ...coupon, usageScope: "joined" }, "busan", []),
    false,
  );
  assert.equal(
    couponAllowsStore({ ...coupon, usageScope: "joined" }, "busan", ["busan"]),
    true,
  );
  assert.equal(
    couponAllowsStore({ ...coupon, usageScope: "invalid" as never }, "busan"),
    false,
  );
});
