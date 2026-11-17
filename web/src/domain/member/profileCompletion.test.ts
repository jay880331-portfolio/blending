import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MemberAccountInfo, MemberProfile } from "./types";
import { getProfileCompletion } from "./profileCompletion";

const profile = (overrides: Partial<MemberProfile> = {}): MemberProfile => ({
  id: "member-1",
  name: "",
  handle: "",
  role: "barista",
  online: false,
  status: "guest",
  workplace: "",
  workplaces: [],
  specialties: [],
  bio: "",
  favoriteCount: 0,
  isPortfolioPublic: false,
  certificateName: "",
  officialBadges: [],
  isOwnProfile: true,
  socials: { instagram: "", threads: "", website: "", recipeUrl: "" },
  ...overrides,
});

const account = (
  overrides: Partial<MemberAccountInfo> = {},
): MemberAccountInfo => ({
  country: "KR",
  identityVerified: false,
  ...overrides,
});

describe("getProfileCompletion", () => {
  it("returns 0 for a profile with no completed fields", () => {
    assert.equal(getProfileCompletion(profile(), account()).score, 0);
  });

  it("counts only completed weighted profile fields", () => {
    const result = getProfileCompletion(
      profile({
        name: "김바리스타",
        handle: "barista",
        avatarUrl: "https://example.com/avatar.jpg",
        workplace: "블렌딩",
        specialties: ["에스프레소"],
      }),
      account(),
    );

    assert.equal(result.score, 45);
    assert.ok(result.missing.includes("연락처"));
  });

  it("returns 100 when every required field is present", () => {
    const result = getProfileCompletion(
      profile({
        name: "김바리스타",
        handle: "barista",
        avatarUrl: "https://example.com/avatar.jpg",
        workplace: "블렌딩",
        specialties: ["에스프레소"],
        bio: "커피를 만듭니다.",
        socials: {
          instagram: "blending",
          threads: "",
          website: "",
          recipeUrl: "",
        },
        baristaProfile: {
          contactPhone: "010-1234-5678",
          employmentTypes: [],
          totalExperience: "",
          certificateFileUrls: [],
          espressoMachineBrands: ["라마르조꼬"],
          espressoMachineBrandOther: "",
          grinderBrands: ["말코닉"],
          grinderBrandOther: "",
          roasterBrands: [],
          roasterBrandOther: "",
          preferredBeans: "에티오피아",
          preferredBeanNotes: ["산미"],
        },
      }),
      account({ phone: "010-0000-0000" }),
    );

    assert.deepEqual(result, { score: 100, missing: [] });
  });

  it("uses the barista contact phone when the account phone is blank", () => {
    const result = getProfileCompletion(
      profile({
        baristaProfile: {
          ...emptyBaristaProfile,
          contactPhone: "010-1234-5678",
        },
      }),
      account({ phone: "   " }),
    );

    assert.equal(result.score, 10);
    assert.ok(!result.missing.includes("연락처"));
  });

  it("counts one social channel and ignores whitespace values", () => {
    const result = getProfileCompletion(
      profile({
        socials: {
          instagram: "  ",
          threads: "blending",
          website: "",
          recipeUrl: "",
        },
      }),
      account(),
    );

    assert.equal(result.score, 7);
    assert.ok(!result.missing.includes("소셜"));
  });

  it("returns 0 for an enthusiast profile with no completed fields", () => {
    const result = getProfileCompletion(
      profile({ role: "enthusiast" }),
      account(),
    );

    assert.deepEqual(result, {
      score: 0,
      missing: [
        "프로필 사진",
        "닉네임",
        "활동 지역",
        "자기소개",
        "취향 키워드",
        "원두 뉘앙스",
        "소셜",
      ],
    });
  });

  it("returns 100 when every enthusiast field is present", () => {
    const result = getProfileCompletion(
      profile({
        role: "enthusiast",
        avatarUrl: "https://example.com/avatar.jpg",
        handle: "coffee_lover",
        activityRegion: "서울 마포구",
        bio: "커피를 좋아합니다.",
        specialties: ["핸드드립"],
        baristaProfile: {
          ...emptyBaristaProfile,
          preferredBeanNotes: ["화사한"],
        },
        socials: {
          instagram: "coffee_lover",
          threads: "",
          website: "",
          recipeUrl: "",
        },
      }),
      account(),
    );

    assert.deepEqual(result, { score: 100, missing: [] });
  });
});

const emptyBaristaProfile = {
  contactPhone: "",
  employmentTypes: [],
  totalExperience: "",
  certificateFileUrls: [],
  espressoMachineBrands: [],
  espressoMachineBrandOther: "",
  grinderBrands: [],
  grinderBrandOther: "",
  roasterBrands: [],
  roasterBrandOther: "",
  preferredBeans: "",
  preferredBeanNotes: [],
};
