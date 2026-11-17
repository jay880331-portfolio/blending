import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allocatePointsFifo,
  calculateAvailablePoints,
  canStoreRunPassport,
  computePointExpiresAt,
  toKstDateKey,
  validateExchangePoints,
  validateReviewBody,
} from "./ledger";

describe("passport ledger domain rules", () => {
  it("computes KST date keys across UTC midnight", () => {
    // 2026-11-17 14:59:59 UTC = 2026-11-17 23:59:59 KST
    assert.equal(
      toKstDateKey(new Date("2026-11-17T14:59:59.000Z")),
      "2026-11-17",
    );
    // 2026-11-17 15:00:00 UTC = 2026-11-18 00:00:00 KST
    assert.equal(
      toKstDateKey(new Date("2026-11-17T15:00:00.000Z")),
      "2026-11-18",
    );
  });

  it("computes 365-day point expiry", () => {
    const created = new Date("2026-11-17T00:00:00.000Z");
    assert.equal(
      computePointExpiresAt(created).toISOString(),
      "2027-11-17T00:00:00.000Z",
    );
  });

  it("calculates balance excluding expired or depleted entries", () => {
    const now = new Date("2026-11-17T12:00:00.000Z");
    const balance = calculateAvailablePoints(
      [
        {
          id: "l1",
          amount: 100,
          remaining: 100,
          expiresAt: "2026-11-17T12:00:01.000Z",
          createdAt: "2025-11-17T12:00:01.000Z",
        },
        {
          id: "l2",
          amount: 100,
          remaining: 50,
          expiresAt: "2027-01-01T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "l3",
          amount: 100,
          remaining: 100,
          expiresAt: "2026-11-17T12:00:00.000Z", // expired
          createdAt: "2025-11-17T12:00:00.000Z",
        },
        {
          id: "l4",
          amount: -100,
          createdAt: "2026-11-01T00:00:00.000Z",
        },
      ],
      now,
    );
    assert.equal(balance, 150);
  });

  it("allocates points in FIFO expiry order and rejects insufficient balance", () => {
    const now = new Date("2026-11-17T12:00:00.000Z");
    const entries = [
      {
        _id: "later",
        amount: 500,
        remaining: 500,
        expiresAt: "2027-06-01T00:00:00.000Z",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
      {
        _id: "expired",
        amount: 500,
        remaining: 500,
        expiresAt: "2026-11-17T10:00:00.000Z",
        createdAt: "2025-11-17T10:00:00.000Z",
      },
      {
        _id: "sooner",
        amount: 300,
        remaining: 200,
        expiresAt: "2027-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const res = allocatePointsFifo(entries, 500, now);
    assert.deepEqual(res, {
      ok: true,
      allocations: [
        { ledgerId: "sooner", amount: 200 },
        { ledgerId: "later", amount: 300 },
      ],
    });

    const insufficient = allocatePointsFifo(entries, 800, now);
    assert.equal(insufficient.ok, false);
  });

  it("validates review body length 10..500", () => {
    assert.equal(validateReviewBody("   짧음   ").ok, false);
    assert.deepEqual(validateReviewBody("  핸드드립 산미가 정말 좋았어요  "), {
      ok: true,
      body: "핸드드립 산미가 정말 좋았어요",
    });
    assert.equal(validateReviewBody("가".repeat(501)).ok, false);
  });

  it("validates exchange points (null/off or 100..10000 in 100P steps)", () => {
    assert.deepEqual(validateExchangePoints(null), { ok: true, points: null });
    assert.deepEqual(validateExchangePoints(1000), { ok: true, points: 1000 });
    assert.equal(validateExchangePoints(50).ok, false);
    assert.equal(validateExchangePoints(150).ok, false);
    assert.equal(validateExchangePoints(10100).ok, false);
  });

  it("exposes canStoreRunPassport gate", () => {
    assert.equal(canStoreRunPassport({ id: "store-1" }), false);
    assert.equal(
      canStoreRunPassport({
        id: "store-1",
        businessVerification: { status: "PENDING" },
      }),
      false,
    );
    assert.equal(
      canStoreRunPassport({
        id: "store-1",
        businessVerification: { status: "REJECTED" },
      }),
      false,
    );
    assert.equal(
      canStoreRunPassport({
        id: "store-1",
        businessVerification: { status: "VERIFIED" },
      }),
      true,
    );
    assert.equal(canStoreRunPassport(null), false);
  });
});
