import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { DELETE, PATCH } from "./route";
import {
  SESSION_COOKIE,
  createUserDocument,
  signSession,
} from "@/infrastructure/server/auth";
import { currentTermsAcceptance } from "@/infrastructure/server/terms";

type UpdateCall = {
  filter: { $and: Array<Record<string, unknown>> };
  update: Record<string, unknown>;
};

function withDatabase(
  user: ReturnType<typeof createUserDocument>,
  onUpdate: (call: UpdateCall) => { matchedCount: number },
) {
  const defaultCollection = { async createIndex() {} };
  const database = {
    collection(name: string) {
      if (name === "users")
        return {
          ...defaultCollection,
          async findOne() {
            return user;
          },
        };
      if (name === "user_sanctions")
        return {
          ...defaultCollection,
          async findOne() {
            return null;
          },
        };
      if (name === "community_daily_notes")
        return {
          ...defaultCollection,
          async updateOne(
            filter: UpdateCall["filter"],
            update: UpdateCall["update"],
          ) {
            return onUpdate({ filter, update });
          },
        };
      return defaultCollection;
    },
  };
  const mongoGlobal = globalThis as typeof globalThis & {
    __blendingMongoClientPromise?: Promise<unknown>;
  };
  const previous = mongoGlobal.__blendingMongoClientPromise;
  mongoGlobal.__blendingMongoClientPromise = Promise.resolve({
    db: () => database,
  });
  return () => {
    if (previous === undefined) delete mongoGlobal.__blendingMongoClientPromise;
    else mongoGlobal.__blendingMongoClientPromise = previous;
  };
}

const params = Promise.resolve({ id: "daily-note-1", commentId: "comment-1" });
const url =
  "http://localhost/api/community/daily-notes/daily-note-1/comments/comment-1";

test("Daily Note 댓글 수정·삭제는 로그인을 요구한다", async () => {
  const [patchResponse, deleteResponse] = await Promise.all([
    PATCH(
      new NextRequest(url, {
        method: "PATCH",
        body: JSON.stringify({ body: "수정" }),
      }),
      { params },
    ),
    DELETE(new NextRequest(url, { method: "DELETE" }), { params }),
  ]);
  assert.equal(patchResponse.status, 401);
  assert.equal(deleteResponse.status, 401);
});

test("Daily Note 댓글 삭제는 본인 댓글만 $pull 하고 commentCount를 줄인다", async () => {
  const user = createUserDocument({
    name: "댓글 작성자",
    termsAcceptance: currentTermsAcceptance(),
  });
  const calls: UpdateCall[] = [];
  const restore = withDatabase(user, (current) => {
    calls.push(current);
    return { matchedCount: 1 };
  });
  try {
    const response = await DELETE(
      new NextRequest(url, {
        method: "DELETE",
        headers: { cookie: `${SESSION_COOKIE}=${signSession(user.id)}` },
      }),
      { params },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true });
    const [call] = calls;
    assert.ok(call);
    assert.deepEqual(call.filter.$and[0], { id: "daily-note-1" });
    assert.deepEqual(call.filter.$and.at(-1), {
      comments: { $elemMatch: { id: "comment-1", ownerId: user.id } },
    });
    assert.deepEqual(call.update, {
      $pull: { comments: { id: "comment-1" } },
      $inc: { commentCount: -1 },
    });
  } finally {
    restore();
  }
});

test("Daily Note 댓글 수정은 본인 댓글 본문만 바꾸고 빈 본문은 거절한다", async () => {
  const user = createUserDocument({
    name: "댓글 작성자",
    termsAcceptance: currentTermsAcceptance(),
  });
  const calls: UpdateCall[] = [];
  const restore = withDatabase(user, (current) => {
    calls.push(current);
    return { matchedCount: 1 };
  });
  const headers = { cookie: `${SESSION_COOKIE}=${signSession(user.id)}` };
  try {
    const empty = await PATCH(
      new NextRequest(url, {
        method: "PATCH",
        body: JSON.stringify({ body: "   " }),
        headers,
      }),
      { params },
    );
    assert.equal(empty.status, 400);
    assert.equal(calls.length, 0);

    const response = await PATCH(
      new NextRequest(url, {
        method: "PATCH",
        body: JSON.stringify({ body: "수정된 댓글" }),
        headers,
      }),
      { params },
    );
    assert.equal(response.status, 200);
    const [call] = calls;
    assert.ok(call);
    assert.deepEqual(call.filter.$and.at(-1), {
      comments: { $elemMatch: { id: "comment-1", ownerId: user.id } },
    });
    assert.deepEqual(call.update, {
      $set: { "comments.$[comment].body": "수정된 댓글" },
    });
  } finally {
    restore();
  }
});

test("Daily Note 댓글 수정·삭제는 타인 댓글이면 404를 돌려준다", async () => {
  const user = createUserDocument({
    name: "다른 사용자",
    termsAcceptance: currentTermsAcceptance(),
  });
  const restore = withDatabase(user, () => ({ matchedCount: 0 }));
  const headers = { cookie: `${SESSION_COOKIE}=${signSession(user.id)}` };
  try {
    const [patchResponse, deleteResponse] = await Promise.all([
      PATCH(
        new NextRequest(url, {
          method: "PATCH",
          body: JSON.stringify({ body: "수정" }),
          headers,
        }),
        { params },
      ),
      DELETE(new NextRequest(url, { method: "DELETE", headers }), { params }),
    ]);
    assert.equal(patchResponse.status, 404);
    assert.equal(deleteResponse.status, 404);
  } finally {
    restore();
  }
});
