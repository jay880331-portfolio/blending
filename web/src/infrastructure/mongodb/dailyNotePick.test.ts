import assert from "node:assert/strict";
import { test } from "node:test";
import { MongoClient, type Db } from "mongodb";
import { DailyNoteMongoRepository } from "./dailyNoteMongoRepository";
import { decodeDailyNoteCursor } from "@/domain/daily-note/dailyNote";

const uri = process.env.STORY_TEST_MONGODB_URI;

test("PICK은 글 하트가 아니라 내가 즐겨찾기한 사람을 기준으로 조회한다", async () => {
  const sources: string[] = [];
  const database = {
    collection(name: string) {
      sources.push(name);
      return {
        find() {
          return {
            sort() {
              return {
                limit() {
                  return {
                    async toArray() {
                      return [];
                    },
                  };
                },
              };
            },
            async toArray() {
              return [];
            },
          };
        },
        aggregate() {
          return {
            async toArray() {
              return [];
            },
          };
        },
      };
    },
  } as unknown as Db;
  await new DailyNoteMongoRepository().listPicked(
    { userId: "me", limit: 6 },
    database,
  );
  assert.ok(sources.includes("member_favorites"));
});

test("PICK은 인메모리 mock DB에서도 즐겨찾기 작성자의 글만 필터링하고 liked 상태를 정확히 매핑한다", async () => {
  const favoriteDocs = [
    { ownerId: "me", id: "fav-user" },
    { ownerId: "me", id: "deleted-user", deletedAt: "2026-10-20" },
  ];
  const storyDocs = [
    {
      id: "story-1",
      ownerId: "fav-user",
      author: { id: "fav-user", nickname: "fav" },
      imageUrls: ["img1.webp"],
      technicals: {},
      featuredTechnicalKeys: [],
      createdAt: "2026-10-20T00:00:00.000Z",
      likeCount: 0,
      commentCount: 0,
      deletedAt: undefined,
    },
    {
      id: "story-2",
      ownerId: "stranger",
      author: { id: "stranger", nickname: "stranger" },
      imageUrls: ["img2.webp"],
      technicals: {},
      featuredTechnicalKeys: [],
      createdAt: "2026-10-20T00:00:00.000Z",
      likeCount: 5,
      commentCount: 0,
      deletedAt: undefined,
    },
  ];
  const likeDocs = [
    {
      targetId: "story-2",
      targetType: "community_daily_note",
      identityKey: "user:me",
    },
  ];

  const database = {
    collection(name: string) {
      return {
        find(query: Record<string, unknown>) {
          let items: unknown[] = [];
          if (name === "member_favorites") {
            items = favoriteDocs.filter(
              (f) => f.ownerId === query.ownerId && !f.deletedAt,
            );
          } else if (name === "community_daily_notes") {
            const allowed = (
              (query.$and as Array<Record<string, unknown>>)?.find(
                (c) => c.ownerId,
              )?.ownerId as { $in: string[] }
            )?.$in;
            items = storyDocs.filter((s) => allowed?.includes(s.ownerId));
          } else if (name === "content_likes") {
            items = likeDocs.filter(
              (l) =>
                l.identityKey === query.identityKey &&
                l.targetType === query.targetType,
            );
          }
          return {
            sort() {
              return {
                limit(n: number) {
                  return {
                    async toArray() {
                      return items.slice(0, n);
                    },
                  };
                },
              };
            },
            async toArray() {
              return items;
            },
          };
        },
      };
    },
  } as unknown as Db;

  const result = await new DailyNoteMongoRepository().listPicked(
    { userId: "me", limit: 6 },
    database,
  );
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, "story-1");
  assert.equal(result.items[0].liked, false);
});

test(
  "PICK은 즐겨찾기한 사람의 글만 조회하고 숨김·차단·삭제를 제외한 뒤 커서 페이지를 구성한다",
  { skip: !uri },
  async () => {
    const client = await MongoClient.connect(uri!);
    const db = client.db(`blending_story_test_${Date.now()}`);
    try {
      const base = {
        author: { id: "fav-author", nickname: "즐겨찾기작가", isBarista: true },
        ownerId: "fav-author",
        imageUrls: ["one.webp", "two.webp"],
        technicals: {},
        featuredTechnicalKeys: [],
        likeCount: 1,
        commentCount: 0,
        createdAt: "2026-10-20T00:00:00.000Z",
        comments: [{ ownerId: "private" }],
      };
      await db.collection("community_daily_notes").insertMany([
        { ...base, id: "a" },
        { ...base, id: "b" },
        { ...base, id: "hidden", moderationStatus: "hidden" },
        { ...base, id: "blocked", ownerId: "blocked" },
        { ...base, id: "other", ownerId: "other-author" },
      ]);
      await db.collection("member_favorites").insertMany([
        { ownerId: "me", id: "fav-author" },
        { ownerId: "me", id: "blocked" },
        {
          ownerId: "me",
          id: "deleted-fav",
          deletedAt: new Date().toISOString(),
        },
        { ownerId: "someone", id: "other-author" },
      ]);
      await db.collection("content_likes").insertMany([
        {
          targetId: "b",
          targetType: "community_daily_note",
          identityKey: "user:me",
        },
        {
          targetId: "other",
          targetType: "community_daily_note",
          identityKey: "user:me",
        },
      ]);
      const repository = new DailyNoteMongoRepository();
      const options = { userId: "me", limit: 1, blockedOwnerIds: ["blocked"] };
      const first = await repository.listPicked(options, db);
      assert.deepEqual(
        first.items.map((note) => note.id),
        ["b"],
      );
      assert.equal(first.items[0].liked, true);
      assert.equal(first.items[0].imageUrls.length, 2);
      assert.equal("ownerId" in first.items[0], false);
      assert.equal("comments" in first.items[0], false);
      assert.ok(first.nextCursor);
      const second = await repository.listPicked(
        { ...options, cursor: decodeDailyNoteCursor(first.nextCursor) },
        db,
      );
      assert.deepEqual(
        second.items.map((note) => note.id),
        ["a"],
      );
      assert.equal(second.items[0].liked, false);
      assert.equal(second.nextCursor, undefined);
      assert.deepEqual(
        (await repository.listPicked({ ...options, userId: "empty" }, db))
          .items,
        [],
      );
      await db
        .collection("content_likes")
        .deleteOne({ targetId: "b", identityKey: "user:me" });
      const afterUnlike = await repository.listPicked(
        { ...options, limit: 6 },
        db,
      );
      assert.deepEqual(
        afterUnlike.items.map((note) => note.id),
        ["b", "a"],
      );
      assert.equal(afterUnlike.items[0].liked, false);
    } finally {
      await db.dropDatabase();
      await client.close();
    }
  },
);
