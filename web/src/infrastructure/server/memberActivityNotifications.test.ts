import assert from "node:assert/strict";
import { test } from "node:test";
import {
  notifyMemberActivity,
  shouldFanOutPublishedNotice,
} from "./memberActivityNotifications";

test("공지는 최초 발행일 때만 팬아웃한다", () => {
  assert.equal(shouldFanOutPublishedNotice("notice", "published"), true);
  assert.equal(
    shouldFanOutPublishedNotice("notice", "published", "draft"),
    true,
  );
  assert.equal(
    shouldFanOutPublishedNotice("notice", "published", "published"),
    false,
  );
  assert.equal(shouldFanOutPublishedNotice("notice", "draft"), false);
  assert.equal(shouldFanOutPublishedNotice("faq", "published"), false);
});

test("자기 자신 활동은 알림함을 쓰지 않는다", async () => {
  let inserted = false;
  const mongoGlobal = globalThis as typeof globalThis & {
    __blendingMongoClientPromise?: Promise<unknown>;
  };
  const previous = mongoGlobal.__blendingMongoClientPromise;
  mongoGlobal.__blendingMongoClientPromise = Promise.resolve({
    db() {
      return {
        collection() {
          return {
            async updateOne() {
              inserted = true;
              return { upsertedCount: 1 };
            },
            async findOne() {
              return { settings: {} };
            },
          };
        },
      };
    },
  });

  try {
    await notifyMemberActivity({
      recipientId: "user-1",
      actorId: "user-1",
      settingKey: "communityLikes",
      kind: "like",
      title: "좋아요",
      href: "/community/qa/1",
      pushTitle: "새 좋아요",
      pushBody: "좋아요",
    });
    assert.equal(inserted, false);
  } finally {
    if (previous === undefined) delete mongoGlobal.__blendingMongoClientPromise;
    else mongoGlobal.__blendingMongoClientPromise = previous;
  }
});
