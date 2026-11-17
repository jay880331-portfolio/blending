import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MemberProfile } from "@/domain/member/types";
import {
  enthusiastHomeCard,
  homeShowsProfessionalSections,
  loggedInHomeCard,
  profileEditCanSave,
  profileEditKeepsStoredProfession,
} from "./homeProfileCard";

describe("home profile card", () => {
  it("uses the same black home header for every role", () => {
    for (const role of ["barista", "enthusiast", "partner", "admin"] as const) {
      assert.equal(
        loggedInHomeCard({ variant: "home", selfHome: true, role }).header,
        "fg",
      );
    }
  });

  it("keeps the public profile card on the previous home header", () => {
    assert.deepEqual(
      loggedInHomeCard({
        variant: "home",
        selfHome: false,
        role: "barista",
      }),
      { header: "fg", enthusiastLayout: false },
    );
    assert.deepEqual(
      loggedInHomeCard({
        variant: "home",
        selfHome: false,
        role: "enthusiast",
      }),
      { header: "fg", enthusiastLayout: false },
    );
    assert.deepEqual(
      loggedInHomeCard({
        variant: "home",
        selfHome: true,
        role: "barista",
      }),
      { header: "fg", enthusiastLayout: false },
    );
    assert.deepEqual(
      loggedInHomeCard({
        variant: "home",
        selfHome: true,
        role: "enthusiast",
      }),
      { header: "fg", enthusiastLayout: true },
    );
  });

  it("keeps stored profession fields when an enthusiast saves", () => {
    assert.equal(profileEditKeepsStoredProfession("enthusiast"), true);
    assert.equal(profileEditKeepsStoredProfession("barista"), false);
    assert.equal(profileEditKeepsStoredProfession("partner"), false);
  });

  it("lets an enthusiast save without a workplace or taste keyword", () => {
    assert.equal(
      profileEditCanSave({
        role: "enthusiast",
        name: "홍길동",
        nickname: "maple",
        skillCount: 0,
        hasWorkplace: false,
      }),
      true,
    );
    assert.equal(
      profileEditCanSave({
        role: "barista",
        name: "홍길동",
        nickname: "maple",
        skillCount: 1,
        hasWorkplace: false,
      }),
      false,
    );
    assert.equal(
      profileEditCanSave({
        role: "enthusiast",
        name: " ",
        nickname: "maple",
        skillCount: 1,
        hasWorkplace: true,
      }),
      false,
    );
  });

  it("hides career sections only for enthusiasts", () => {
    assert.equal(homeShowsProfessionalSections("enthusiast"), false);
    assert.equal(homeShowsProfessionalSections("barista"), true);
    assert.equal(homeShowsProfessionalSections("partner"), true);
  });

  it("keeps the enthusiast card to taste and social fields", () => {
    const card = enthusiastHomeCard(
      profile({
        handle: "maple",
        activityRegion: "서울 마포구",
        bio: "산미 있는 커피",
        specialties: ["핸드드립", " "],
        baristaProfile: {
          ...emptyBaristaProfile,
          preferredBeanNotes: ["화사한"],
          espressoMachineBrands: ["라마르조꼬"],
        },
        socials: {
          instagram: "maple",
          threads: "maple",
          website: "https://maple.example",
          recipeUrl: "https://recipe.example",
        },
        workplace: "블렌딩 카페",
      }),
    );

    assert.deepEqual(Object.keys(card).sort(), [
      "activityRegion",
      "bio",
      "instagram",
      "keywords",
      "nickname",
      "nuances",
      "threads",
      "website",
    ]);
    assert.equal(card.nickname, "maple");
    assert.equal(card.activityRegion, "서울 마포구");
    assert.deepEqual(card.keywords, ["핸드드립"]);
    assert.deepEqual(card.nuances, ["화사한"]);
    assert.equal("workplace" in card, false);
    assert.equal("espressoMachineBrands" in card, false);
  });

  it("shows 등록 전 when enthusiast identity fields are blank", () => {
    const card = enthusiastHomeCard(profile({}));

    assert.equal(card.nickname, "등록 전");
    assert.equal(card.activityRegion, "등록 전");
    assert.equal(card.bio, "등록 전");
    assert.deepEqual(card.keywords, []);
    assert.deepEqual(card.nuances, []);
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

function profile(overrides: Partial<MemberProfile>): MemberProfile {
  return {
    id: "member-1",
    name: "김커피",
    handle: "",
    role: "enthusiast",
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
  };
}
