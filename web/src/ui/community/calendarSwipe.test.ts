import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCalendarMonthSwipeDelta } from "./calendarSwipe";

describe("getCalendarMonthSwipeDelta", () => {
  it("changes to the previous or next month for a horizontal swipe beyond the threshold", () => {
    assert.equal(
      getCalendarMonthSwipeDelta({ x: 100, y: 200 }, { x: 146, y: 205 }),
      -1,
    );
    assert.equal(
      getCalendarMonthSwipeDelta({ x: 146, y: 205 }, { x: 100, y: 200 }),
      1,
    );
  });

  it("keeps the month while a vertical scroll has incidental horizontal drift", () => {
    assert.equal(
      getCalendarMonthSwipeDelta({ x: 100, y: 100 }, { x: 150, y: 260 }),
      0,
    );
  });

  it("keeps the month when the horizontal movement does not exceed the threshold", () => {
    assert.equal(
      getCalendarMonthSwipeDelta({ x: 100, y: 200 }, { x: 145, y: 200 }),
      0,
    );
  });
});
