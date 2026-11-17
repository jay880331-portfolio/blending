import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "./route";
import {
  SESSION_COOKIE,
  createUserDocument,
  signSession,
} from "@/infrastructure/server/auth";
import { currentTermsAcceptance } from "@/infrastructure/server/terms";

test("이벤트 요청은 검증된 분류와 정규화된 신청 정보를 저장한다", async () => {
  const user = createUserDocument({
    name: "요청 사용자",
    termsAcceptance: currentTermsAcceptance(),
  });
  let inserted: Record<string, unknown> | undefined;
  let adminFilter: Record<string, unknown> | undefined;
  const database = {
    collection(name: string) {
      if (name === "users")
        return {
          async findOne() {
            return user;
          },
          find(filter: Record<string, unknown>) {
            adminFilter = filter;
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
      if (name === "user_sanctions")
        return {
          async findOne() {
            return null;
          },
        };
      if (name === "community_event_requests")
        return {
          async insertOne(document: Record<string, unknown>) {
            inserted = document;
          },
        };
      throw new Error(`unexpected collection: ${name}`);
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
    const response = await POST(
      new NextRequest("http://localhost/api/community/event-requests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE}=${signSession(user.id)}`,
        },
        body: JSON.stringify({
          title: "바리스타 세미나",
          body: "신청을 받습니다.",
          category: "seminar",
          applyUrl: " apply.blending.example/form ",
          location: "  블렌딩 홀  ",
          address: "  서울시 중구  ",
        }),
      }),
    );

    assert.equal(response.status, 201);
    assert.deepEqual(
      {
        category: inserted?.category,
        applyUrl: inserted?.applyUrl,
        location: inserted?.location,
        address: inserted?.address,
      },
      {
        category: "seminar",
        applyUrl: "https://apply.blending.example/form",
        location: "블렌딩 홀",
        address: "서울시 중구",
      },
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(adminFilter, {
      role: "admin",
      $or: [{ accountStatus: "active" }, { accountStatus: { $exists: false } }],
    });

    const invalidCategory = await POST(
      new NextRequest("http://localhost/api/community/event-requests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE}=${signSession(user.id)}`,
        },
        body: JSON.stringify({
          title: "잘못된 요청",
          body: "분류를 검증합니다.",
          category: "invalid",
        }),
      }),
    );

    assert.equal(invalidCategory.status, 400);
    assert.deepEqual(await invalidCategory.json(), {
      message: "이벤트 카테고리를 확인해주세요.",
    });
  } finally {
    if (previousClientPromise === undefined)
      delete mongoGlobal.__blendingMongoClientPromise;
    else mongoGlobal.__blendingMongoClientPromise = previousClientPromise;
  }
});
