import assert from "node:assert/strict";
import { test } from "node:test";
import type { ClientSession, Db } from "mongodb";
import {
  applyContentLikeMutation,
  applyEmbeddedCommentLikeMutation,
} from "./contentLikes";

test("좋아요 upsert와 대상 카운트 변경은 같은 session을 사용한다", async () => {
  const session = { id: "session-1" } as unknown as ClientSession;
  const sessions: unknown[] = [];
  const db = {
    collection(name: string) {
      if (name === "daily_notes") {
        return {
          findOne: async (_filter: unknown, options: { session: unknown }) => {
            sessions.push(options.session);
            return { id: "note-1", likeCount: 0 };
          },
          findOneAndUpdate: async (
            _filter: unknown,
            _update: unknown,
            options: { session: unknown },
          ) => {
            sessions.push(options.session);
            return { id: "note-1", likeCount: 1 };
          },
        };
      }
      return {
        updateOne: async (
          _filter: unknown,
          _update: unknown,
          options: { session: unknown },
        ) => {
          sessions.push(options.session);
          return { upsertedCount: 1 };
        },
      };
    },
  } as unknown as Db;

  await applyContentLikeMutation(db, session, {
    collectionName: "daily_notes",
    targetType: "community_daily_note",
    targetId: "note-1",
    liked: true,
    identityKey: "user-1",
    countField: "likeCount",
  });

  assert.deepEqual(sessions, [session, session, session]);
});

test("좋아요 취소와 대상 카운트 변경은 같은 session을 사용한다", async () => {
  const session = { id: "session-1" } as unknown as ClientSession;
  const sessions: unknown[] = [];
  const db = {
    collection(name: string) {
      if (name === "daily_notes") {
        return {
          findOne: async (_filter: unknown, options: { session: unknown }) => {
            sessions.push(options.session);
            return { id: "note-1", likeCount: 1 };
          },
          findOneAndUpdate: async (
            _filter: unknown,
            _update: unknown,
            options: { session: unknown },
          ) => {
            sessions.push(options.session);
            return { id: "note-1", likeCount: 0 };
          },
        };
      }
      return {
        deleteOne: async (_filter: unknown, options: { session: unknown }) => {
          sessions.push(options.session);
          return { deletedCount: 1 };
        },
      };
    },
  } as unknown as Db;

  await applyContentLikeMutation(db, session, {
    collectionName: "daily_notes",
    targetType: "community_daily_note",
    targetId: "note-1",
    liked: false,
    identityKey: "user-1",
    countField: "likeCount",
  });

  assert.deepEqual(sessions, [session, session, session]);
});

test("댓글 좋아요는 중첩 댓글의 owner와 카운트를 갱신한다", async () => {
  const session = { id: "session-1" } as unknown as ClientSession;
  const incs: unknown[] = [];
  const db = {
    collection(name: string) {
      if (name === "community_qa_posts") {
        return {
          findOne: async () => ({
            id: "qa-1",
            comments: [
              {
                id: "comment-1",
                likes: 0,
                ownerId: "owner-1",
                replies: [{ id: "reply-1", likes: 2, ownerId: "owner-2" }],
              },
            ],
          }),
          updateOne: async (
            _filter: unknown,
            update: unknown,
            options: { session: unknown },
          ) => {
            incs.push({ update, session: options.session });
            return { modifiedCount: 1 };
          },
        };
      }
      return {
        updateOne: async () => ({ upsertedCount: 1 }),
      };
    },
  } as unknown as Db;

  const result = await applyEmbeddedCommentLikeMutation(db, session, {
    collectionName: "community_qa_posts",
    targetType: "community_qa_comment",
    parentId: "qa-1",
    commentId: "reply-1",
    liked: true,
    identityKey: "user:actor",
  });

  assert.equal(result?.commentOwnerId, "owner-2");
  assert.equal(result?.likes, 3);
  assert.equal(result?.changed, true);
  assert.equal(incs.length, 1);
});
