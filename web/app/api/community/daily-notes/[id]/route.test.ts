import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import * as handlers from "./route";
import {
  SESSION_COOKIE,
  createUserDocument,
  signSession,
} from "@/infrastructure/server/auth";
import { currentTermsAcceptance } from "@/infrastructure/server/terms";

test("Daily Note 상세 API는 차단한 작성자의 노트를 찾을 수 없게 한다", async () => {
  const user = createUserDocument({
    name: "차단 사용자",
    termsAcceptance: currentTermsAcceptance(),
  });
  const note = {
    id: "daily-note-1",
    ownerId: "blocked-author",
    author: {
      id: "blocked-author",
      nickname: "차단된 작성자",
      isBarista: false,
    },
    imageUrls: ["https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/note.jpg"],
    technicals: {},
    featuredTechnicalKeys: [],
    liked: false,
    likeCount: 0,
    commentCount: 0,
    comments: [],
    createdAt: "2026-08-14T00:00:00.000Z",
  };
  const defaultCollection = {
    async createIndex() {},
  };
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
          async findOne(query: { $and: Array<Record<string, unknown>> }) {
            const blockedOwnerIds = query.$and.find(
              (filter) => "ownerId" in filter,
            )?.ownerId as { $nin?: string[] } | undefined;
            return blockedOwnerIds?.$nin?.includes(note.ownerId) ? null : note;
          },
        };
      if (name === "content_likes")
        return {
          ...defaultCollection,
          find() {
            return {
              project() {
                return {
                  async toArray() {
                    return [];
                  },
                };
              },
            };
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
    const response = await handlers.GET(
      new NextRequest(
        "http://localhost/api/community/daily-notes/daily-note-1",
        {
          headers: { cookie: `${SESSION_COOKIE}=${signSession(user.id)}` },
        },
      ),
      { params: Promise.resolve({ id: note.id }) },
    );

    assert.equal(response.status, 404);
  } finally {
    if (previousClientPromise === undefined)
      delete mongoGlobal.__blendingMongoClientPromise;
    else mongoGlobal.__blendingMongoClientPromise = previousClientPromise;
  }
});

test("Daily Note 상세 API는 작성자에게만 관리 권한을 내려준다", async () => {
  const user = createUserDocument({
    name: "작성자",
    termsAcceptance: currentTermsAcceptance(),
  });
  const note = {
    id: "daily-note-1",
    ownerId: user.id,
    author: { id: user.id, nickname: "작성자", isBarista: false },
    imageUrls: ["https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/note.jpg"],
    technicals: {},
    featuredTechnicalKeys: [],
    liked: false,
    likeCount: 0,
    commentCount: 0,
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
          async findOne() {
            return note;
          },
        };
      if (name === "content_likes")
        return {
          ...defaultCollection,
          find() {
            return {
              project() {
                return {
                  async toArray() {
                    return [];
                  },
                };
              },
            };
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
    const response = await handlers.GET(
      new NextRequest(
        "http://localhost/api/community/daily-notes/daily-note-1",
        { headers: { cookie: `${SESSION_COOKIE}=${signSession(user.id)}` } },
      ),
      { params: Promise.resolve({ id: note.id }) },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      id: note.id,
      author: note.author,
      imageUrls: note.imageUrls,
      technicals: {},
      featuredTechnicalKeys: [],
      liked: false,
      likeCount: 0,
      commentCount: 0,
      comments: [],
      createdAt: note.createdAt,
      isOwner: true,
      canManage: true,
    });
  } finally {
    if (previousClientPromise === undefined)
      delete mongoGlobal.__blendingMongoClientPromise;
    else mongoGlobal.__blendingMongoClientPromise = previousClientPromise;
  }
});

test("Daily Note 수정 API는 작성자만 원자적으로 편집값을 저장한다", async () => {
  const patch = (handlers as { PATCH?: typeof handlers.GET }).PATCH;
  assert.equal(typeof patch, "function");

  const user = createUserDocument({
    name: "작성자",
    termsAcceptance: currentTermsAcceptance(),
  });
  const note = {
    id: "daily-note-1",
    ownerId: user.id,
    author: { id: user.id, nickname: "작성자", isBarista: false },
    imageUrls: [
      "https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/daily-notes/" +
        `${user.id}/before.jpg`,
    ],
    technicals: {},
    featuredTechnicalKeys: [],
    liked: false,
    likeCount: 4,
    commentCount: 2,
    comments: [],
    createdAt: "2026-08-14T00:00:00.000Z",
  };
  let updateFilter: unknown;
  let update: unknown;
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
          async findOneAndUpdate(filter: unknown, next: unknown) {
            updateFilter = filter;
            update = next;
            return {
              ...note,
              imageUrls: [
                `https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/daily-notes/${user.id}/after.jpg`,
              ],
              technicals: { machine: "Linea Mini" },
              featuredTechnicalKeys: ["machine"],
            };
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
    const response = await patch!(
      new NextRequest(
        "http://localhost/api/community/daily-notes/daily-note-1",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            cookie: `${SESSION_COOKIE}=${signSession(user.id)}`,
          },
          body: JSON.stringify({
            imageUrls: [
              `https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/daily-notes/${user.id}/after.jpg`,
            ],
            technicals: { machine: "Linea Mini" },
            featuredTechnicalKeys: ["machine"],
          }),
        },
      ),
      { params: Promise.resolve({ id: note.id }) },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(updateFilter, { id: note.id, ownerId: user.id });
    assert.deepEqual(update, {
      $set: {
        imageUrls: [
          `https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/daily-notes/${user.id}/after.jpg`,
        ],
        technicals: { machine: "Linea Mini" },
        featuredTechnicalKeys: ["machine"],
      },
      $unset: { note: "", location: "" },
    });
    const { ownerId, ...publicNote } = note;
    assert.equal(ownerId, user.id);
    assert.deepEqual(await response.json(), {
      ...publicNote,
      imageUrls: [
        `https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/daily-notes/${user.id}/after.jpg`,
      ],
      technicals: { machine: "Linea Mini" },
      featuredTechnicalKeys: ["machine"],
      canManage: true,
      isOwner: true,
    });
  } finally {
    if (previousClientPromise === undefined)
      delete mongoGlobal.__blendingMongoClientPromise;
    else mongoGlobal.__blendingMongoClientPromise = previousClientPromise;
  }
});

test("Daily Note 삭제 API는 ownerId가 일치할 때만 영구 삭제한다", async () => {
  const remove = (handlers as { DELETE?: typeof handlers.GET }).DELETE;
  assert.equal(typeof remove, "function");

  const user = createUserDocument({
    name: "삭제 작성자",
    termsAcceptance: currentTermsAcceptance(),
  });
  let deleteFilter: unknown;
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
          async deleteOne(filter: unknown) {
            deleteFilter = filter;
            return { deletedCount: 1 };
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
    const response = await remove!(
      new NextRequest(
        "http://localhost/api/community/daily-notes/daily-note-1",
        {
          method: "DELETE",
          headers: { cookie: `${SESSION_COOKIE}=${signSession(user.id)}` },
        },
      ),
      { params: Promise.resolve({ id: "daily-note-1" }) },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(deleteFilter, { id: "daily-note-1", ownerId: user.id });
    assert.deepEqual(await response.json(), { success: true });
  } finally {
    if (previousClientPromise === undefined)
      delete mongoGlobal.__blendingMongoClientPromise;
    else mongoGlobal.__blendingMongoClientPromise = previousClientPromise;
  }
});
