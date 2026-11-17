import assert from "node:assert/strict";
import { test } from "node:test";
import type { MemberProfile } from "@/domain/member/types";
import type { UserDocument } from "@/infrastructure/server/auth";
import { directoryProfileFromUser, directoryUserFilter } from "./directory";

const barista: UserDocument = {
  id: "barista-1",
  name: "김바리스타",
  role: "barista",
  workplaces: [],
  specialties: ["브루잉"],
  socials: { instagram: "", threads: "", website: "", recipeUrl: "" },
  socialAccounts: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

test("위치가 없는 활성 바리스타도 디렉터리 프로필로 만든다", () => {
  assert.deepEqual(directoryProfileFromUser(barista), {
    profileId: "barista-1",
    name: "김바리스타",
    workplace: "",
    workplaces: [],
    addresses: [],
    bio: "",
    handle: "barista-1",
    role: "barista",
    skills: ["브루잉"],
  });
});

test("디렉터리 조회는 바리스타와 활성 계정만 대상으로 한다", () => {
  assert.deepEqual(directoryUserFilter(), {
    role: "barista",
    $or: [{ accountStatus: "active" }, { accountStatus: { $exists: false } }],
  });
});

test("저장된 프로필 정보가 있으면 디렉터리에 우선 반영한다", () => {
  const profile = {
    ...barista,
    id: "profile-1",
    ownerId: barista.id,
    workplace: "블렌딩 카페",
    handle: "blending-kim",
    online: true,
    status: "focused",
    bio: "",
    favoriteCount: 0,
    isPortfolioPublic: false,
    certificateName: "",
    officialBadges: [],
    isOwnProfile: false,
  } satisfies MemberProfile & { ownerId: string };

  assert.deepEqual(directoryProfileFromUser(barista, profile), {
    profileId: "barista-1",
    name: "김바리스타",
    workplace: "블렌딩 카페",
    workplaces: ["블렌딩 카페"],
    addresses: [],
    bio: "",
    handle: "blending-kim",
    role: "barista",
    skills: ["브루잉"],
  });
  assert.deepEqual(
    directoryProfileFromUser(barista, profile, "WBC 2021").badgeName,
    "WBC 2021",
  );
});

test("여러 근무지와 주소, 소개를 검색용 디렉터리 데이터로 함께 만든다", () => {
  const profile = {
    ...barista,
    id: "profile-1",
    ownerId: barista.id,
    workplace: "블렌딩 카페",
    handle: "blending-kim",
    online: true,
    status: "focused",
    bio: "브루잉을 좋아합니다.",
    favoriteCount: 0,
    isPortfolioPublic: false,
    certificateName: "",
    officialBadges: [],
    isOwnProfile: false,
    workplaces: ["블렌딩 카페", "라떼커피랩", "블렌딩 카페"],
    workplaceLocations: [
      {
        id: "loc-1",
        name: "블렌딩 카페",
        address: "서울 종로구 블렌딩로 1",
        lat: 37.57,
        lng: 126.98,
        displayName: "블렌딩 카페",
      },
      {
        id: "loc-2",
        name: "라떼커피랩",
        address: "서울 마포구 라떼로 2",
        lat: 37.55,
        lng: 126.91,
        displayName: "라떼커피랩",
      },
    ],
  } satisfies MemberProfile & { ownerId: string };

  assert.deepEqual(directoryProfileFromUser(barista, profile), {
    profileId: "barista-1",
    name: "김바리스타",
    workplace: "블렌딩 카페",
    workplaces: ["블렌딩 카페", "라떼커피랩"],
    addresses: ["서울 종로구 블렌딩로 1", "서울 마포구 라떼로 2"],
    bio: "브루잉을 좋아합니다.",
    handle: "blending-kim",
    role: "barista",
    skills: ["브루잉"],
  });
});

test("같은 이름의 다른 지점도 주소 순서와 함께 보존한다", () => {
  const profile = {
    ...barista,
    id: "profile-1",
    ownerId: barista.id,
    workplace: "블렌딩",
    handle: "blending-kim",
    online: true,
    status: "focused",
    bio: "",
    favoriteCount: 0,
    isPortfolioPublic: false,
    certificateName: "",
    officialBadges: [],
    isOwnProfile: false,
    workplaces: ["블렌딩"],
    workplaceLocations: [
      {
        id: "loc-1",
        name: "블렌딩",
        address: "서울 종로구 1",
        lat: 37.57,
        lng: 126.98,
        displayName: "블렌딩",
      },
      {
        id: "loc-2",
        name: "블렌딩",
        address: "부산 해운대구 2",
        lat: 35.16,
        lng: 129.16,
        displayName: "블렌딩",
      },
    ],
  } satisfies MemberProfile & { ownerId: string };

  const directoryProfile = directoryProfileFromUser(barista, profile);

  assert.deepEqual(directoryProfile.workplaces, ["블렌딩", "블렌딩"]);
  assert.deepEqual(directoryProfile.addresses, [
    "서울 종로구 1",
    "부산 해운대구 2",
  ]);
});
