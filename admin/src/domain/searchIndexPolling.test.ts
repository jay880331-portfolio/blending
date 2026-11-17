import assert from "node:assert/strict";
import { it } from "node:test";
import { startSearchIndexPolling } from "./searchIndexPolling";

it("polls while running and cancels the scheduled poll", async () => {
  let scheduled: (() => void | Promise<void>) | undefined;
  let cancelled = false;
  let polls = 0;
  const stop = startSearchIndexPolling(
    async () => ++polls < 2,
    (callback, delay) => {
      assert.equal(delay, 3000);
      scheduled = callback;
      return 1;
    },
    () => {
      cancelled = true;
    },
  );

  assert.ok(scheduled);
  await scheduled();
  assert.equal(polls, 1);
  assert.ok(scheduled);
  stop();
  assert.equal(cancelled, true);
});

it("retries a transient failure and stops only on a terminal result", async () => {
  const results = [undefined, true, false];
  let scheduled: (() => void | Promise<void>) | undefined;
  let schedules = 0;
  startSearchIndexPolling(
    async () => results.shift(),
    (callback) => {
      schedules += 1;
      scheduled = callback;
      return schedules;
    },
    () => {},
  );

  await scheduled?.();
  assert.equal(schedules, 2, "transient failure schedules a retry");
  await scheduled?.();
  assert.equal(schedules, 3, "running result keeps polling");
  await scheduled?.();
  assert.equal(schedules, 3, "terminal result stops polling");
});
