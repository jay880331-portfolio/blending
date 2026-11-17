import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { createUserDocument } from "@/infrastructure/server/auth";
import { createMemberProfileRoute } from "./memberProfileRoute";

test("deleting으로 전환된 계정은 프로필과 검색 문서를 남기지 않는다", async () => {
  const user = createUserDocument({ name: "기존 이름" });
  let profile: Record<string, unknown> | undefined;
  let search: Record<string, unknown> | undefined;
  const session = {
    withTransaction: async (work: () => Promise<void>) => {
      user.accountStatus = "deleting";
      await work();
    },
    endSession: async () => undefined,
  };
  const users = {
    updateOne: async () => ({ matchedCount: 0 }),
  };
  const profiles = {
    updateOne: async (_filter: unknown, update: { $set?: object }) => {
      profile = (update.$set ?? {}) as Record<string, unknown>;
    },
    findOne: async () => profile ?? null,
  };
  const route = createMemberProfileRoute({
    getCurrentUser: async () => user as never,
    getMongoClient: async () => ({ startSession: () => session }) as never,
    getMongoDb: async () =>
      ({
        collection: (name: string) =>
          name === "member_profiles" ? profiles : users,
      }) as never,
    syncProfileSearchDocument: async (value) => {
      search = value as Record<string, unknown>;
    },
  });

  const response = await route(profileRequest());

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    message: "프로필을 저장할 수 없습니다.",
  });
  assert.equal(profile, undefined);
  assert.equal(search, undefined);
});

test("프로필 저장 인프라 오류는 세부 정보를 노출하지 않고 500을 반환한다", async () => {
  for (const failure of ["transaction", "profile", "search"] as const) {
    const user = createUserDocument({ name: "기존 이름" });
    const session = {
      withTransaction: async (work: () => Promise<void>) => {
        if (failure === "transaction") throw new Error("secret-transaction");
        await work();
      },
      endSession: async () => undefined,
    };
    const profiles = {
      updateOne: async () => {
        if (failure === "profile") throw new Error("secret-profile");
      },
      findOne: async () => ({ id: "profile-1" }),
    };
    const route = createMemberProfileRoute({
      getCurrentUser: async () => user as never,
      getMongoClient: async () => ({ startSession: () => session }) as never,
      getMongoDb: async () =>
        ({
          collection: (name: string) =>
            name === "member_profiles"
              ? profiles
              : { updateOne: async () => ({ matchedCount: 1 }) },
        }) as never,
      syncProfileSearchDocument: async () => {
        if (failure === "search") throw new Error("secret-search");
      },
    });

    const response = await route(profileRequest());

    assert.equal(response.status, 500, failure);
    assert.deepEqual(await response.json(), {
      message: "프로필을 저장할 수 없습니다.",
    });
  }
});

test("검색 동기화 실패는 트랜잭션의 프로필과 검색 변경을 롤백한다", async () => {
  const user = createUserDocument({ name: "기존 이름" });
  let profile = { name: "기존 이름" };
  let search = { title: "기존 이름" };
  const session = {
    withTransaction: async (work: () => Promise<void>) => {
      const originalProfile = structuredClone(profile);
      const originalSearch = structuredClone(search);
      try {
        await work();
      } catch (error) {
        profile = originalProfile;
        search = originalSearch;
        throw error;
      }
    },
    endSession: async () => undefined,
  };
  const route = createMemberProfileRoute({
    getCurrentUser: async () => user as never,
    getMongoClient: async () => ({ startSession: () => session }) as never,
    getMongoDb: async () =>
      ({
        collection: (name: string) =>
          name === "member_profiles"
            ? {
                updateOne: async () => {
                  profile = { name: "변경 이름" };
                },
                findOne: async () => ({ id: "profile-1", ...profile }),
              }
            : { updateOne: async () => ({ matchedCount: 1 }) },
      }) as never,
    syncProfileSearchDocument: async () => {
      search = { title: "변경 이름" };
      throw new Error("secret-search");
    },
  });

  const response = await route(profileRequest());

  assert.equal(response.status, 500);
  assert.deepEqual(profile, { name: "기존 이름" });
  assert.deepEqual(search, { title: "기존 이름" });
});

test("이미 저장된 소속의 null 선택 필드는 이후 수정에서도 유지한다", async () => {
  const user = createUserDocument({ name: "기존 이름" });
  let savedPatch: Record<string, unknown> | undefined;
  const session = {
    withTransaction: async (work: () => Promise<void>) => {
      await work();
    },
    endSession: async () => undefined,
  };
  const profiles = {
    updateOne: async (
      _filter: unknown,
      update: { $set?: Record<string, unknown> },
    ) => {
      savedPatch = update.$set;
    },
    findOne: async () => ({ id: user.id, ownerId: user.id }),
  };
  const route = createMemberProfileRoute({
    getCurrentUser: async () => user as never,
    getMongoClient: async () => ({ startSession: () => session }) as never,
    getMongoDb: async () =>
      ({
        collection: (name: string) =>
          name === "member_profiles"
            ? profiles
            : { updateOne: async () => ({ matchedCount: 1 }) },
      }) as never,
    syncProfileSearchDocument: async () => undefined,
  });

  const response = await route(
    profileRequest({
      name: "홍길동",
      handle: "jay",
      workplaceLocations: [
        {
          id: "postcode-26470",
          name: "제이커피",
          address: "강원특별자치도 원주시 치악로 1469",
          postalCode: null,
          detailAddress: null,
          employmentTypes: null,
          lat: 37.3161436,
          lng: 127.9680931,
          displayName: "제이커피 · 강원특별자치도 원주시 치악로 1469",
        },
      ],
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(Array.isArray(savedPatch?.workplaceLocations), true);
  assert.equal(
    (savedPatch?.workplaceLocations as Array<{ name: string }>)[0]?.name,
    "제이커피",
  );
});

function profileRequest(body: Record<string, unknown> = { name: "변경 이름" }) {
  return new NextRequest("https://blending.test/api/member/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
