import assert from "node:assert/strict";
import test from "node:test";
import type { Db } from "mongodb";
import type { EventReview } from "@/domain/community/types";
import { ReviewWriteMongoRepository } from "./reviewWriteMongoRepository";

test("ReviewWriteMongoRepository는 community_reviews 컬렉션에 ownerId를 포함하여 저장하고, Mongo mutation _id를 유출하지 않는다", async () => {
  const captured: {
    accessedCollectionName: string | null;
    insertedDocument: Record<string, unknown> | null;
  } = {
    accessedCollectionName: null,
    insertedDocument: null,
  };

  const fakeCollection = {
    insertOne: async (doc: Record<string, unknown>) => {
      captured.insertedDocument = { ...doc };
      // MongoDB 드라이버의 실제 동작: 인자로 전달된 doc 객체에 _id를 직접 mutation
      doc._id = "mongo-internal-object-id";
      doc._createdAt = "internal-timestamp";
      return { acknowledged: true, insertedId: doc._id };
    },
  };

  const fakeDb = {
    collection: (name: string) => {
      captured.accessedCollectionName = name;
      return fakeCollection;
    },
  } as unknown as Db;

  const repository = new ReviewWriteMongoRepository(async () => fakeDb);

  const review: EventReview = {
    id: "review-test-1",
    eventId: "event-1",
    title: "후기 제목",
    category: "meetup",
    author: {
      name: "테스터",
      handle: "tester",
    },
    createdAt: "2026-09-05T00:00:00.000Z",
    imageUrls: ["https://example.com/image.jpg"],
    keywords: ["커피", "모임"],
    likes: 0,
    body: "후기 본문 내용입니다.",
  };

  const result = await repository.save(review, "user-owner-999");

  // 컬렉션 이름 검증
  assert.equal(captured.accessedCollectionName, "community_reviews");

  // 저장 시점의 문서에 ownerId 포함 확인
  assert.equal(captured.insertedDocument?.ownerId, "user-owner-999");
  assert.equal(captured.insertedDocument?.id, "review-test-1");

  // Mongo _id mutation 발생 시에도 반환 객체에 _id, _createdAt, ownerId가 유출되지 않아야 함 (toDomain)
  assert.equal("_id" in result, false);
  assert.equal("_createdAt" in result, false);
  assert.equal("ownerId" in result, false);

  // 나머지 도메인 필드는 정상 유지
  assert.equal(result.id, "review-test-1");
  assert.equal(result.title, "후기 제목");
  assert.equal(result.category, "meetup");
  assert.deepEqual(result.author, { name: "테스터", handle: "tester" });
  assert.deepEqual(result.imageUrls, ["https://example.com/image.jpg"]);
  assert.deepEqual(result.keywords, ["커피", "모임"]);
  assert.equal(result.likes, 0);
  assert.equal(result.body, "후기 본문 내용입니다.");
});
