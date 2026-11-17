import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advanceBaristaDirectoryRandomWindowStart,
  buildBaristaDirectorySections,
  createBaristaDirectoryShuffleState,
  getBaristaDirectoryInitial,
  getDirectoryMatchedWorkplace,
  getDirectoryProfileHref,
  getHorizontalScrollIndicatorGeometry,
  getKoreanInitial,
  matchesMapSearch,
  orderBaristaDirectoryProfiles,
  reconcileBaristaDirectoryShuffleState,
  rotateBaristaDirectoryProfiles,
} from "./mapDirectory";

describe("buildBaristaDirectorySections", () => {
  const profiles = [
    { id: "3", name: "김바리", handle: "coffee_kim", workplace: "브루잉랩" },
    {
      id: "1",
      name: "나로스",
      handle: "roaster_na",
      workplace: "커피스튜디오",
    },
    { id: "2", name: "강바다", handle: "latte_kang", workplace: "라떼하우스" },
  ];

  it("groups baristas by Korean initial and sorts each section by name", () => {
    assert.deepEqual(
      buildBaristaDirectorySections(profiles, "").map((section) => ({
        initial: section.initial,
        names: section.profiles.map((profile) => profile.name),
      })),
      [
        { initial: "ㄱ", names: ["강바다", "김바리"] },
        { initial: "ㄴ", names: ["나로스"] },
      ],
    );
  });

  it("filters by barista name or workplace", () => {
    assert.deepEqual(
      buildBaristaDirectorySections(profiles, "라떼").flatMap((section) =>
        section.profiles.map((profile) => profile.name),
      ),
      ["강바다"],
    );
    assert.deepEqual(
      buildBaristaDirectorySections(profiles, "나로").flatMap((section) =>
        section.profiles.map((profile) => profile.name),
      ),
      ["나로스"],
    );
    assert.deepEqual(
      buildBaristaDirectorySections(profiles, "roaster_na").flatMap((section) =>
        section.profiles.map((profile) => profile.name),
      ),
      ["나로스"],
    );
  });

  it("filters by every registered workplace and existing extra search field", () => {
    const multiWorkplaceProfiles = [
      {
        id: "1",
        name: "김바리",
        handle: "coffee_kim",
        workplace: "블렌딩 커피",
        workplaces: ["블렌딩 커피", "라떼커피랩"],
        addresses: ["서울 종로구 블렌딩로 1"],
        bio: "브루잉과 라떼아트를 합니다.",
        skills: ["브루잉"],
      },
      {
        id: "2",
        name: "박바리",
        handle: "latte_park",
        workplace: "라떼하우스",
        workplaces: ["라떼하우스"],
        skills: ["라떼아트"],
      },
    ];

    assert.deepEqual(
      buildBaristaDirectorySections(
        multiWorkplaceProfiles,
        "라떼커피랩",
      ).flatMap((section) => section.profiles.map((profile) => profile.name)),
      ["김바리"],
    );
    assert.deepEqual(
      buildBaristaDirectorySections(multiWorkplaceProfiles, "종로구").flatMap(
        (section) => section.profiles.map((profile) => profile.name),
      ),
      ["김바리"],
    );
    assert.deepEqual(
      buildBaristaDirectorySections(multiWorkplaceProfiles, "브루잉과").flatMap(
        (section) => section.profiles.map((profile) => profile.name),
      ),
      ["김바리"],
    );
    assert.deepEqual(
      buildBaristaDirectorySections(multiWorkplaceProfiles, "라떼아트").flatMap(
        (section) => section.profiles.map((profile) => profile.name),
      ),
      ["김바리", "박바리"],
    );
  });

  it("matches the same location context for map and directory profiles", () => {
    const mapFirst = {
      id: "1",
      name: "김바리스타",
      handle: "coffee_kim",
      workplace: "블렌딩 카페",
      address: "서울 종로구 1",
      bio: "브루잉을 합니다.",
      skills: ["브루잉"],
    };
    const mapSecond = {
      ...mapFirst,
      id: "2",
      workplace: "라떼커피랩",
      address: "부산 해운대구 2",
    };
    const directoryProfile = {
      ...mapFirst,
      workplaces: ["블렌딩 카페", "라떼커피랩"],
      addresses: ["서울 종로구 1", "부산 해운대구 2"],
    };

    [
      "블렌딩 카페 서울",
      "김바리스타 블렌딩",
      "라떼커피랩 부산",
      "김바리스타 라떼커피랩",
    ].forEach((query) => {
      const expectedMapProfile = query.includes("라떼") ? mapSecond : mapFirst;

      assert.equal(matchesMapSearch(expectedMapProfile, query), true);
      assert.equal(matchesMapSearch(directoryProfile, query), true);
      assert.deepEqual(
        buildBaristaDirectorySections([directoryProfile], query).flatMap(
          (section) => section.profiles.map((profile) => profile.name),
        ),
        ["김바리스타"],
      );
    });
  });

  it("normalizes whitespace and case like the map search", () => {
    const profile = {
      id: "1",
      name: "Kim Barista",
      handle: "coffee_kim",
      workplace: "Blending Cafe",
      address: "Seoul Jongno 1",
    };

    assert.equal(
      matchesMapSearch(profile, "  kim   barista   blending "),
      true,
    );
    assert.equal(matchesMapSearch(profile, "BLENDING CAFE SEOUL"), true);
    assert.equal(matchesMapSearch(profile, "blending cafe seoul"), true);
    assert.deepEqual(
      buildBaristaDirectorySections(
        [profile],
        "  BLENDING   CAFE   SEOUL ",
      ).flatMap((section) => section.profiles.map((item) => item.name)),
      ["Kim Barista"],
    );
  });

  it("gets a Korean initial from the full barista name", () => {
    assert.equal(getKoreanInitial("김바리"), "ㄱ");
    assert.equal(getKoreanInitial("나로스"), "ㄴ");
  });

  it("classifies English, other scripts, and doubled Korean initials for filters", () => {
    assert.equal(getBaristaDirectoryInitial("anna"), "A–Z");
    assert.equal(getBaristaDirectoryInitial("Zoe"), "A–Z");
    assert.equal(getBaristaDirectoryInitial("123커피"), "#");
    assert.equal(getBaristaDirectoryInitial("!커피"), "#");
    assert.equal(getBaristaDirectoryInitial("까미"), "ㄱ");
  });
});

describe("getDirectoryMatchedWorkplace", () => {
  const profile = {
    name: "김바리",
    workplace: "블렌딩 커피",
    workplaces: ["블렌딩 커피", "라떼커피랩"],
    addresses: ["서울 종로구 1", "부산 해운대구 2"],
  };

  it("shows the workplace that matched the search query", () => {
    assert.equal(
      getDirectoryMatchedWorkplace(profile, "라떼커피랩"),
      "라떼커피랩",
    );
    assert.equal(getDirectoryMatchedWorkplace(profile, "라떼"), "라떼커피랩");
    assert.equal(
      getDirectoryMatchedWorkplace(profile, "김바리 라떼커피랩"),
      "라떼커피랩",
    );
    assert.equal(
      getDirectoryMatchedWorkplace(profile, "블렌딩 커피 서울"),
      "블렌딩 커피",
    );
    assert.equal(
      getDirectoryMatchedWorkplace(profile, "라떼커피랩 부산"),
      "라떼커피랩",
    );
  });

  it("falls back to the primary workplace without a matching query", () => {
    assert.equal(
      getDirectoryMatchedWorkplace(profile, "김바리"),
      "블렌딩 커피",
    );
    assert.equal(getDirectoryMatchedWorkplace(profile, ""), "블렌딩 커피");
  });
});

describe("getDirectoryProfileHref", () => {
  it("opens a coordinate-free directory profile through its public URL", () => {
    assert.equal(
      getDirectoryProfileHref("barista / 1"),
      "/profile/barista%20%2F%201",
    );
  });
});

describe("barista directory shuffle state", () => {
  it("creates one Fisher-Yates queue without duplicate profile IDs", () => {
    const profileIds = ["a", "b", "a", "c", "d"];
    const state = createBaristaDirectoryShuffleState(profileIds, () => 0);

    assert.deepEqual(state.roster, ["a", "b", "c", "d"]);
    assert.equal(state.remaining.length, 4);
    assert.deepEqual(new Set(state.remaining), new Set(["a", "b", "c", "d"]));
    assert.deepEqual(profileIds, ["a", "b", "a", "c", "d"]);
  });

  it("does not put an already exposed ID back into the remaining queue", () => {
    assert.deepEqual(
      reconcileBaristaDirectoryShuffleState(
        ["a", "b", "c"],
        { roster: ["a", "b", "c"], remaining: ["c"] },
        () => 0,
      ),
      { roster: ["a", "b", "c"], remaining: ["c"] },
    );
  });

  it("reconciles roster additions and deletions without duplicate IDs", () => {
    assert.deepEqual(
      reconcileBaristaDirectoryShuffleState(
        ["b", "c", "d", "d"],
        { roster: ["a", "b", "c"], remaining: ["c"] },
        () => 0,
      ),
      { roster: ["b", "c", "d"], remaining: ["c", "d"] },
    );
  });

  it("recovers a malformed saved state with a fresh unique queue", () => {
    const state = reconcileBaristaDirectoryShuffleState(
      ["a", "b", "c"],
      { roster: ["a", "a"], remaining: ["a"] },
      () => 0,
    );

    assert.deepEqual(state.roster, ["a", "b", "c"]);
    assert.deepEqual(new Set(state.remaining), new Set(["a", "b", "c"]));
  });
});

describe("orderBaristaDirectoryProfiles", () => {
  const profiles = [
    { profileId: "a", name: "A" },
    { profileId: "b", name: "B" },
    { profileId: "c", name: "C" },
  ];

  it("keeps the full roster when remaining has one unseen profile", () => {
    assert.deepEqual(
      orderBaristaDirectoryProfiles(profiles, ["c"]).map(
        (profile) => profile.profileId,
      ),
      ["c", "a", "b"],
    );
  });

  it("returns the current roster when remaining is empty", () => {
    assert.deepEqual(
      orderBaristaDirectoryProfiles(profiles, []).map(
        (profile) => profile.profileId,
      ),
      ["a", "b", "c"],
    );
  });
});

describe("rotateBaristaDirectoryProfiles", () => {
  it("keeps every roster profile visible", () => {
    const roster = Array.from({ length: 11 }, (_, index) => `${index + 1}`);

    assert.deepEqual(rotateBaristaDirectoryProfiles(roster, 3), [
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "1",
      "2",
      "3",
    ]);
  });

  it("rotates the full roster from a late start", () => {
    assert.deepEqual(rotateBaristaDirectoryProfiles(["a", "b", "c", "d"], 3), [
      "d",
      "a",
      "b",
      "c",
    ]);
  });

  it("returns every profile exactly once", () => {
    assert.deepEqual(rotateBaristaDirectoryProfiles(["a", "b", "c"], 2), [
      "c",
      "a",
      "b",
    ]);
  });
});

describe("advanceBaristaDirectoryRandomWindowStart", () => {
  it("resumes at the first unexposed profile after leaving random mode", () => {
    assert.equal(advanceBaristaDirectoryRandomWindowStart(16, 8, true), 24);
    assert.equal(advanceBaristaDirectoryRandomWindowStart(16, 8, false), 16);
  });

  it("wraps to the first profile after every profile has been exposed", () => {
    assert.equal(advanceBaristaDirectoryRandomWindowStart(0, 1, true, 1), 0);
    assert.equal(advanceBaristaDirectoryRandomWindowStart(0, 8, true, 24), 8);
  });
});

describe("getHorizontalScrollIndicatorGeometry", () => {
  it("sizes and positions the thumb from the scroll progress", () => {
    assert.deepEqual(getHorizontalScrollIndicatorGeometry(100, 200, 50), {
      offset: 25,
      thumbWidth: 50,
    });
  });

  it("fills the track when content does not overflow and handles invalid sizes", () => {
    assert.deepEqual(getHorizontalScrollIndicatorGeometry(100, 100, 50), {
      offset: 0,
      thumbWidth: 100,
    });
    assert.deepEqual(getHorizontalScrollIndicatorGeometry(0, 100, 0), {
      offset: 0,
      thumbWidth: 0,
    });
  });
});
