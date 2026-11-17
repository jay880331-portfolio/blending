import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST as postComment } from "./comments/route";
import { POST as postLike } from "./like/route";
import {
  SESSION_COOKIE,
  createUserDocument,
  signSession,
} from "@/infrastructure/server/auth";
import { currentTermsAcceptance } from "@/infrastructure/server/terms";

test("Daily Note 좋아요와 댓글 mutation은 로그인을 요구한다", async () => {
  const [likeResponse, commentResponse] = await Promise.all([
    postLike(
      new NextRequest(
        "http://localhost/api/community/daily-notes/daily-note-1/like",
        { method: "POST", body: JSON.stringify({ liked: true }) },
      ),
      { params: Promise.resolve({ id: "daily-note-1" }) },
    ),
    postComment(
      new NextRequest(
        "http://localhost/api/community/daily-notes/daily-note-1/comments",
        { method: "POST", body: JSON.stringify({ body: "댓글" }) },
      ),
      { params: Promise.resolve({ id: "daily-note-1" }) },
    ),
  ]);

  assert.equal(likeResponse.status, 401);
  assert.equal(commentResponse.status, 401);
});

test("Daily Note 댓글 길이와 좋아요 상태 형식을 서버에서 검증한다", async () => {
  const user = createUserDocument({
    name: "검증 사용자",
    termsAcceptance: currentTermsAcceptance(),
  });
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
  const headers = { cookie: `${SESSION_COOKIE}=${signSession(user.id)}` };

  try {
    const [commentResponse, likeResponse] = await Promise.all([
      postComment(
        new NextRequest(
          "http://localhost/api/community/daily-notes/daily-note-1/comments",
          {
            method: "POST",
            body: JSON.stringify({ body: "가".repeat(1001) }),
            headers,
          },
        ),
        { params: Promise.resolve({ id: "daily-note-1" }) },
      ),
      postLike(
        new NextRequest(
          "http://localhost/api/community/daily-notes/daily-note-1/like",
          {
            method: "POST",
            body: JSON.stringify({ liked: "true" }),
            headers,
          },
        ),
        { params: Promise.resolve({ id: "daily-note-1" }) },
      ),
    ]);

    assert.equal(commentResponse.status, 400);
    assert.equal(likeResponse.status, 400);
  } finally {
    if (previousClientPromise === undefined)
      delete mongoGlobal.__blendingMongoClientPromise;
    else mongoGlobal.__blendingMongoClientPromise = previousClientPromise;
  }
});

test("Daily Note 좋아요와 댓글 mutation은 차단한 작성자 노트를 404 처리한다", async () => {
  const user = createUserDocument({
    name: "차단 사용자",
    termsAcceptance: currentTermsAcceptance(),
  });
  let dailyNoteFilter: { $and: Array<Record<string, unknown>> } | undefined;
  let commentFilter: { $and: Array<Record<string, unknown>> } | undefined;
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
      if (name === "user_blocks")
        return {
          ...defaultCollection,
          async distinct() {
            return ["blocked-author"];
          },
        };
      if (name === "community_daily_notes")
        return {
          ...defaultCollection,
          async findOne(filter: { $and: Array<Record<string, unknown>> }) {
            dailyNoteFilter = filter;
            return null;
          },
          async findOneAndUpdate(filter: {
            $and: Array<Record<string, unknown>>;
          }) {
            commentFilter = filter;
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
  const headers = { cookie: `${SESSION_COOKIE}=${signSession(user.id)}` };

  try {
    const likeResponse = await postLike(
      new NextRequest(
        "http://localhost/api/community/daily-notes/daily-note-1/like",
        {
          method: "POST",
          body: JSON.stringify({ liked: true }),
          headers,
        },
      ),
      { params: Promise.resolve({ id: "daily-note-1" }) },
    );
    const commentResponse = await postComment(
      new NextRequest(
        "http://localhost/api/community/daily-notes/daily-note-1/comments",
        {
          method: "POST",
          body: JSON.stringify({ body: "댓글" }),
          headers,
        },
      ),
      { params: Promise.resolve({ id: "daily-note-1" }) },
    );

    assert.equal(likeResponse.status, 404);
    assert.equal(commentResponse.status, 404);
    assert.deepEqual(dailyNoteFilter?.$and.at(-1), {
      ownerId: { $nin: ["blocked-author"] },
    });
    assert.deepEqual(
      commentFilter?.$and.find((item) => "ownerId" in item),
      {
        ownerId: { $nin: ["blocked-author"] },
      },
    );
  } finally {
    if (previousClientPromise === undefined)
      delete mongoGlobal.__blendingMongoClientPromise;
    else mongoGlobal.__blendingMongoClientPromise = previousClientPromise;
  }
});

test("Daily Note 댓글 상한은 409으로 구분한다", async () => {
  const user = createUserDocument({
    name: "댓글 사용자",
    termsAcceptance: currentTermsAcceptance(),
  });
  let commentFilter: { $and: Array<Record<string, unknown>> } | undefined;
  const note = {
    id: "daily-note-1",
    ownerId: "author",
    author: { id: "author", nickname: "작성자", isBarista: false },
    imageUrls: ["https://example.com/note.jpg"],
    technicals: {},
    featuredTechnicalKeys: [],
    liked: false,
    likeCount: 0,
    commentCount: 1000,
    comments: [],
    createdAt: "2026-08-14T00:00:00.000Z",
  };
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
      if (name === "user_blocks")
        return {
          ...defaultCollection,
          async distinct() {
            return [];
          },
        };
      if (name === "community_daily_notes")
        return {
          ...defaultCollection,
          async findOneAndUpdate(filter: {
            $and: Array<Record<string, unknown>>;
          }) {
            commentFilter = filter;
            return null;
          },
          async findOne() {
            return note;
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
    const response = await postComment(
      new NextRequest(
        "http://localhost/api/community/daily-notes/daily-note-1/comments",
        {
          method: "POST",
          body: JSON.stringify({ body: "댓글" }),
          headers: { cookie: `${SESSION_COOKIE}=${signSession(user.id)}` },
        },
      ),
      { params: Promise.resolve({ id: "daily-note-1" }) },
    );

    assert.equal(response.status, 409);
    assert.deepEqual(commentFilter?.$and.at(-1), {
      $expr: {
        $lt: [{ $size: { $ifNull: ["$comments", []] } }, 1000],
      },
    });
  } finally {
    if (previousClientPromise === undefined)
      delete mongoGlobal.__blendingMongoClientPromise;
    else mongoGlobal.__blendingMongoClientPromise = previousClientPromise;
  }
});
