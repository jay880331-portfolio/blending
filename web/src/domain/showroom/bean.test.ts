import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canTransitionReservation,
  parseBeanInput,
  parseReservationInput,
} from "./bean";

describe("showroom bean & reservation domain rules", () => {
  it("validates bean and dripbag inputs", () => {
    const bean = parseBeanInput({
      kind: "bean",
      name: "에티오피아 예가체프",
      notes: "자스민, 베르가못",
      unit: "200g",
      price: 18000,
      grindOptions: ["whole", "drip", "whole"],
    });
    assert.deepEqual(bean, {
      ok: true,
      value: {
        kind: "bean",
        name: "에티오피아 예가체프",
        notes: "자스민, 베르가못",
        unit: "200g",
        price: 18000,
        grindOptions: ["whole", "drip"],
        active: true,
      },
    });

    const dripbag = parseBeanInput({
      kind: "dripbag",
      name: "시그니처 드립백",
      notes: "",
      unit: "10개입",
      price: 15000,
      grindOptions: ["whole"],
    });
    assert.equal(dripbag.ok, true);
    if (dripbag.ok) {
      assert.deepEqual(dripbag.value.grindOptions, []);
    }

    assert.equal(
      parseBeanInput({
        kind: "bean",
        name: "원두",
        notes: "",
        unit: "200g",
        price: 10000,
        grindOptions: [],
      }).ok,
      false,
    );
  });

  it("validates reservation quantity, KST pickupDate range, and grind", () => {
    const now = new Date("2026-11-17T03:00:00.000Z"); // 2026-11-17 KST
    const bean = {
      kind: "bean" as const,
      grindOptions: ["whole" as const, "drip" as const],
      active: true,
    };

    assert.equal(
      parseReservationInput(
        {
          grind: "whole",
          quantity: 2,
          pickupDate: "2026-11-20",
          note: "선물용입니다",
        },
        bean,
        now,
      ).ok,
      true,
    );

    // Out of range (> +14 days)
    assert.equal(
      parseReservationInput(
        { grind: "whole", quantity: 1, pickupDate: "2026-12-02", note: "" },
        bean,
        now,
      ).ok,
      false,
    );

    // Past date
    assert.equal(
      parseReservationInput(
        { grind: "whole", quantity: 1, pickupDate: "2026-11-16", note: "" },
        bean,
        now,
      ).ok,
      false,
    );

    // Non-existent calendar dates
    assert.equal(
      parseReservationInput(
        { grind: "whole", quantity: 1, pickupDate: "2026-11-39", note: "" },
        bean,
        now,
      ).ok,
      false,
    );
    assert.equal(
      parseReservationInput(
        { grind: "whole", quantity: 1, pickupDate: "2026-02-30", note: "" },
        bean,
        new Date("2026-02-20T03:00:00.000Z"),
      ).ok,
      false,
    );
    // Leap year date allowed
    assert.equal(
      parseReservationInput(
        { grind: "whole", quantity: 1, pickupDate: "2028-02-29", note: "" },
        bean,
        new Date("2028-02-20T03:00:00.000Z"),
      ).ok,
      true,
    );

    // Invalid grind
    assert.equal(
      parseReservationInput(
        { grind: "machine", quantity: 1, pickupDate: "2026-11-18", note: "" },
        bean,
        now,
      ).ok,
      false,
    );
  });

  it("enforces reservation state transitions for customer and staff", () => {
    const now = new Date("2026-11-17T03:00:00.000Z"); // 2026-11-17 KST

    // Customer can cancel REQUESTED/CONFIRMED before pickupDate
    assert.equal(
      canTransitionReservation({
        currentStatus: "REQUESTED",
        nextStatus: "CANCELLED",
        actorRole: "customer",
        pickupDate: "2026-11-18",
        now,
      }).ok,
      true,
    );
    // Customer cannot cancel on pickupDate
    assert.equal(
      canTransitionReservation({
        currentStatus: "CONFIRMED",
        nextStatus: "CANCELLED",
        actorRole: "customer",
        pickupDate: "2026-11-17",
        now,
      }).ok,
      false,
    );
    // Customer cannot confirm
    assert.equal(
      canTransitionReservation({
        currentStatus: "REQUESTED",
        nextStatus: "CONFIRMED",
        actorRole: "customer",
        pickupDate: "2026-11-18",
        now,
      }).ok,
      false,
    );

    // Staff transitions
    assert.equal(
      canTransitionReservation({
        currentStatus: "REQUESTED",
        nextStatus: "CONFIRMED",
        actorRole: "staff",
        pickupDate: "2026-11-17",
        now,
      }).ok,
      true,
    );
    assert.equal(
      canTransitionReservation({
        currentStatus: "CONFIRMED",
        nextStatus: "PICKED_UP",
        actorRole: "staff",
        pickupDate: "2026-11-17",
        now,
      }).ok,
      true,
    );
    assert.equal(
      canTransitionReservation({
        currentStatus: "REJECTED",
        nextStatus: "PICKED_UP",
        actorRole: "staff",
        pickupDate: "2026-11-17",
        now,
      }).ok,
      false,
    );
  });
});
