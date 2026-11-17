import assert from "node:assert/strict";
import { test } from "node:test";
import { MongoClient } from "mongodb";
import type { MemberInterestItem } from "@/domain/member/types";
import { MemberMongoRepository } from "./memberMongoRepository";

test("MemberMongoRepository getInterests는 DB mock 환경에서도 community_daily_note 관심글을 매핑한다", async () => {
  const mongoGlobal = globalThis as typeof globalThis & {
    __blendingMongoClientPromise?: Promise<MongoClient>;
  };
  const previous = mongoGlobal.__blendingMongoClientPromise;

  const likes = [
    {
      targetId: "story-1",
      targetType: "community_daily_note",
      identityKey: "user:me",
      createdAt: new Date("2026-10-20T01:00:00Z"),
    },
    {
      targetId: "story-2",
      targetType: "community_daily_note",
      identityKey: "user:me",
      createdAt: new Date("2026-10-20T02:00:00Z"),
    },
  ];
  const notes = [
    {
      id: "story-1",
      ownerId: "author-1",
      author: { id: "author-1", nickname: "작가1", isBarista: false },
      note: "스토리 본문 내용",
      imageUrls: ["cover.webp"],
      likeCount: 10,
      commentCount: 2,
      createdAt: "2026-10-20T00:00:00.000Z",
    },
    {
      id: "story-2",
      ownerId: "author-2",
      author: { id: "author-2", nickname: "작가2", isBarista: true },
      note: "",
      imageUrls: [],
      likeCount: 5,
      commentCount: 0,
      createdAt: "2026-10-20T00:00:00.000Z",
    },
  ];

  const fakeDb = {
    collection(name: string) {
      return {
        find(query: Record<string, unknown>) {
          let res: unknown[] = [];
          if (name === "content_likes") {
            res = likes;
          } else if (name === "community_daily_notes") {
            const inIds = (
              (query.$and as Array<Record<string, unknown>>)?.find((c) => c.id)
                ?.id as { $in: string[] }
            )?.$in;
            res = notes.filter((n) => inIds?.includes(n.id));
          } else {
            res = [];
          }
          return {
            project() {
              return {
                async toArray() {
                  return [];
                },
              };
            },
            sort(s: Record<string, number>) {
              const sorted = [...res];
              if (s.createdAt === -1) {
                sorted.sort(
                  (a, b) =>
                    new Date((b as { createdAt: string }).createdAt).getTime() -
                    new Date((a as { createdAt: string }).createdAt).getTime(),
                );
              }
              return {
                async toArray() {
                  return sorted;
                },
              };
            },
            async toArray() {
              return res;
            },
          };
        },
      };
    },
  };

  mongoGlobal.__blendingMongoClientPromise = Promise.resolve({
    db: () => fakeDb,
  } as unknown as MongoClient);

  try {
    const repository = new MemberMongoRepository("me", []) as unknown as {
      getInterests(): Promise<MemberInterestItem[]>;
    };
    const items = await repository.getInterests();
    assert.equal(items.length, 2);
    // 최신 하트순 (story-2 createdAt > story-1 createdAt)
    assert.equal(items[0].id, "story-2");
    assert.equal(items[0].title, "작가2님의 STORY");
    assert.equal(items[0].excerpt, "STORY");
    assert.equal(items[0].href, "/community/daily-note/story-2");
    assert.equal(items[0].liked, true);

    assert.equal(items[1].id, "story-1");
    assert.equal(items[1].title, "스토리 본문 내용");
    assert.equal(items[1].imageUrl, "cover.webp");
    assert.equal(items[1].likeCount, 10);
    assert.equal(items[1].commentCount, 2);
  } finally {
    if (previous === undefined) delete mongoGlobal.__blendingMongoClientPromise;
    else mongoGlobal.__blendingMongoClientPromise = previous;
  }
});

test(
  "내 관심 글은 내 하트 STORY만 조회하고 숨김·차단·삭제와 다른 사람 하트를 제외한다",
  {
    skip: !process.env.STORY_TEST_MONGODB_URI,
  },
  async () => {
    const client = await MongoClient.connect(
      process.env.STORY_TEST_MONGODB_URI!,
    );
    const db = client.db(`blending_interest_test_${Date.now()}`);
    const mongoGlobal = globalThis as typeof globalThis & {
      __blendingMongoClientPromise?: Promise<MongoClient>;
    };
    const previous = mongoGlobal.__blendingMongoClientPromise;
    // 실제 쿼리는 격리 DB에서 실행하고 운영 연결은 사용하지 않는다.
    mongoGlobal.__blendingMongoClientPromise = Promise.resolve({
      db: () => db,
    } as unknown as MongoClient);
    try {
      const note = {
        ownerId: "author",
        author: { id: "author", nickname: "작가", isBarista: true },
        note: "오늘의 커피",
        imageUrls: ["first.webp", "second.webp"],
        likeCount: 2,
        commentCount: 3,
        createdAt: "2026-10-20T00:00:00.000Z",
      };
      await db.collection("community_daily_notes").insertMany([
        { ...note, id: "liked" },
        { ...note, id: "photo-only", note: "" },
        { ...note, id: "hidden", moderationStatus: "hidden" },
        { ...note, id: "blocked", ownerId: "blocked" },
        { ...note, id: "other" },
      ]);
      await db.collection("content_likes").insertMany([
        ...["liked", "photo-only", "hidden", "blocked", "deleted"].map(
          (targetId, index) => ({
            identityKey: "user:me",
            targetType: "community_daily_note",
            targetId,
            createdAt: new Date(2026, 9, 20, 0, index),
          }),
        ),
        {
          identityKey: "user:someone",
          targetType: "community_daily_note",
          targetId: "other",
          createdAt: new Date(),
        },
      ]);
      const repository = new MemberMongoRepository("me", [
        "blocked",
      ]) as unknown as {
        getInterests(): Promise<MemberInterestItem[]>;
      };
      const items = await repository.getInterests();
      assert.deepEqual(
        items.map((item) => item.id),
        ["photo-only", "liked"],
      );
      const liked = items[1];
      assert.equal(liked.href, "/community/daily-note/liked");
      assert.equal(liked.imageUrl, "first.webp");
      assert.equal(liked.author, "작가");
      assert.equal(liked.likeCount, 2);
      assert.equal(liked.commentCount, 3);
      assert.equal(liked.liked, true);
      assert.ok(items[0].title.trim());
      await db
        .collection("content_likes")
        .deleteOne({ identityKey: "user:me", targetId: "liked" });
      assert.deepEqual(
        (await repository.getInterests()).map((item) => item.id),
        ["photo-only"],
      );
    } finally {
      if (previous === undefined)
        delete mongoGlobal.__blendingMongoClientPromise;
      else mongoGlobal.__blendingMongoClientPromise = previous;
      await db.dropDatabase();
      await client.close();
    }
  },
);
