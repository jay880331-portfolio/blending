import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DAILY_NOTE_FEED_PROJECTION,
  DailyNoteMongoRepository,
  MAX_DAILY_NOTE_COMMENTS,
  toDailyNoteFeedItem,
} from "./dailyNoteMongoRepository";

test("Daily Note 피드 projection과 DTO는 피드에 필요한 필드만 유지한다", () => {
  assert.deepEqual(DAILY_NOTE_FEED_PROJECTION, {
    _id: 0,
    id: 1,
    imageUrls: { $slice: 1 },
    technicals: 1,
    featuredTechnicalKeys: 1,
    createdAt: 1,
  });
  assert.deepEqual(
    toDailyNoteFeedItem({
      id: "daily-note-1",
      imageUrls: ["first.jpg", "second.jpg"],
      technicals: { beanName: "에티오피아", grinder: "EK43" },
      featuredTechnicalKeys: ["beanName"],
      createdAt: "2026-08-14T00:00:00.000Z",
    }),
    {
      id: "daily-note-1",
      imageUrls: ["first.jpg"],
      technicals: { beanName: "에티오피아" },
      featuredTechnicalKeys: ["beanName"],
      createdAt: "2026-08-14T00:00:00.000Z",
    },
  );
});

test("Daily Note 목록은 Mongo projection으로 피드 DTO만 읽는다", async () => {
  const note = {
    id: "daily-note-1",
    imageUrls: ["first.jpg"],
    technicals: { beanName: "에티오피아" },
    featuredTechnicalKeys: ["beanName"],
    createdAt: "2026-08-14T00:00:00.000Z",
  };
  let projection: unknown;
  const defaultCollection = { async createIndex() {} };
  const database = {
    collection(name: string) {
      if (name === "community_daily_notes") {
        return {
          ...defaultCollection,
          find(_filter: unknown, options?: { projection?: unknown }) {
            projection = options?.projection;
            return {
              sort() {
                return this;
              },
              limit() {
                return this;
              },
              async toArray() {
                return [note];
              },
            };
          },
        };
      }
      return defaultCollection;
    },
  };
  const mongoGlobal = globalThis as typeof globalThis & {
    __blendingMongoClientPromise?: Promise<unknown>;
  };
  const previousClientPromise = mongoGlobal.__blendingMongoClientPromise;
  mongoGlobal.__blendingMongoClientPromise = Promise.resolve({
    db: () => database,
  });

  try {
    const result = await new DailyNoteMongoRepository().list({ limit: 1 });

    assert.deepEqual(projection, DAILY_NOTE_FEED_PROJECTION);
    assert.deepEqual(result.items, [note]);
  } finally {
    if (previousClientPromise === undefined)
      delete mongoGlobal.__blendingMongoClientPromise;
    else mongoGlobal.__blendingMongoClientPromise = previousClientPromise;
  }
});

test("Daily Note 목록은 내 피드만 볼 때 소유자 조건을 넣는다", async () => {
  let filter: { $and?: Array<Record<string, unknown>> } | undefined;
  const defaultCollection = { async createIndex() {} };
  const database = {
    collection(name: string) {
      if (name === "community_daily_notes") {
        return {
          ...defaultCollection,
          find(nextFilter: { $and?: Array<Record<string, unknown>> }) {
            filter = nextFilter;
            return {
              sort() {
                return this;
              },
              limit() {
                return this;
              },
              async toArray() {
                return [];
              },
            };
          },
        };
      }
      return defaultCollection;
    },
  };
  const mongoGlobal = globalThis as typeof globalThis & {
    __blendingMongoClientPromise?: Promise<unknown>;
  };
  const previousClientPromise = mongoGlobal.__blendingMongoClientPromise;
  mongoGlobal.__blendingMongoClientPromise = Promise.resolve({
    db: () => database,
  });

  try {
    await new DailyNoteMongoRepository().list({
      limit: 3,
      ownerId: "member-1",
    });
    assert.deepEqual(filter?.$and?.at(-1), { ownerId: "member-1" });

    await new DailyNoteMongoRepository().list({ limit: 3 });
    assert.equal(
      filter?.$and?.some(
        (clause) => "ownerId" in clause && clause.ownerId === "member-1",
      ),
      false,
    );
  } finally {
    if (previousClientPromise === undefined)
      delete mongoGlobal.__blendingMongoClientPromise;
    else mongoGlobal.__blendingMongoClientPromise = previousClientPromise;
  }
});

test("Daily Note 댓글은 차단한 작성자 노트를 원자적으로 제외한다", async () => {
  let filter: { $and: Array<Record<string, unknown>> } | undefined;
  const defaultCollection = { async createIndex() {} };
  const database = {
    collection(name: string) {
      if (name === "community_daily_notes")
        return {
          ...defaultCollection,
          async findOne() {
            return null;
          },
          async findOneAndUpdate(nextFilter: {
            $and: Array<Record<string, unknown>>;
          }) {
            filter = nextFilter;
            return null;
          },
        };
      return defaultCollection;
    },
  };
  const mongoGlobal = globalThis as typeof globalThis & {
    __blendingMongoClientPromise?: Promise<unknown>;
  };
  const previousClientPromise = mongoGlobal.__blendingMongoClientPromise;
  mongoGlobal.__blendingMongoClientPromise = Promise.resolve({
    db: () => database,
  });

  try {
    const result = await new DailyNoteMongoRepository().addComment(
      "daily-note-1",
      {
        id: "comment-1",
        ownerId: "user-a",
        authorName: "사용자",
        createdAgo: "방금",
        body: "댓글",
        likes: 0,
      },
      ["blocked-author"],
    );

    assert.equal(result.status, "not-found");
    assert.deepEqual(
      filter?.$and.find((item) => "ownerId" in item),
      {
        ownerId: { $nin: ["blocked-author"] },
      },
    );
    assert.deepEqual(filter?.$and.at(-1), {
      $expr: {
        $lt: [
          { $size: { $ifNull: ["$comments", []] } },
          MAX_DAILY_NOTE_COMMENTS,
        ],
      },
    });
  } finally {
    if (previousClientPromise === undefined)
      delete mongoGlobal.__blendingMongoClientPromise;
    else mongoGlobal.__blendingMongoClientPromise = previousClientPromise;
  }
});
