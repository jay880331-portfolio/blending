import assert from "node:assert/strict";
import test from "node:test";
import { LAST_SEEN_THROTTLE_MS, recordLastSeen } from "./lastSeen";

test("첫 lastSeenAt은 활성 계정에 기록한다", async () => {
  const filters: unknown[] = [];
  const updates: unknown[] = [];
  const users = {
    updateOne: async (filter: unknown, update: unknown) => {
      filters.push(filter);
      updates.push(update);
      return { matchedCount: 1 };
    },
  };

  const now = new Date("2026-09-15T13:00:00.000Z");
  const result = await recordLastSeen(users as never, {
    userId: "user-1",
    now,
  });

  assert.deepEqual(result, { updated: true });
  assert.deepEqual(filters[0], {
    id: "user-1",
    $and: [
      {
        $or: [
          { accountStatus: "active" },
          { accountStatus: { $exists: false } },
        ],
      },
      {
        $or: [
          { lastSeenAt: { $exists: false } },
          { lastSeenAt: { $lte: new Date("2026-09-15T12:55:00.000Z") } },
        ],
      },
    ],
  });
  assert.deepEqual(updates[0], { $set: { lastSeenAt: now } });
  assert.equal(LAST_SEEN_THROTTLE_MS, 5 * 60 * 1000);
});

test("쓰로틀 안이면 matchedCount 0을 skipped로 본다", async () => {
  const users = {
    updateOne: async () => ({ matchedCount: 0 }),
  };
  const result = await recordLastSeen(users as never, {
    userId: "user-1",
    now: new Date("2026-09-15T13:00:00.000Z"),
  });
  assert.deepEqual(result, { updated: false });
});
