import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  baristaIdFromMapSearch,
  searchMembers,
  type MemberSearchCandidate,
} from "./memberSearch";

function candidate(
  overrides: Partial<MemberSearchCandidate> &
    Pick<MemberSearchCandidate, "userId" | "name" | "role">,
): MemberSearchCandidate {
  return {
    handle: overrides.name,
    ...overrides,
  };
}

describe("searchMembers", () => {
  const people: MemberSearchCandidate[] = [
    candidate({
      userId: "jenny",
      name: "제니",
      handle: "제니",
      role: "barista",
    }),
    candidate({
      userId: "kim-barista",
      name: "김기일",
      handle: "김기일",
      role: "barista",
      workplace: "홈플러스",
    }),
    candidate({
      userId: "kim-admin",
      name: "김기일(T)",
      handle: "coffee",
      role: "admin",
    }),
    candidate({
      userId: "bang",
      name: "방정호 Jungho Bang",
      handle: "jungho",
      role: "barista",
    }),
    candidate({
      userId: "enthusiast",
      name: "시은",
      handle: "sieun",
      role: "enthusiast",
    }),
    candidate({
      userId: "suspended",
      name: "제니",
      handle: "paused",
      role: "barista",
      accountStatus: "suspended",
    }),
    candidate({
      userId: "blocked",
      name: "제니",
      handle: "blocked",
      role: "barista",
      blocked: true,
    }),
  ];

  it("finds a person by name even when the search index missed them", () => {
    assert.deepEqual(
      searchMembers(people, "제니").map((hit) => hit.userId),
      ["jenny"],
    );
  });

  it("hides admin accounts and still returns the same name on a public role", () => {
    assert.deepEqual(
      searchMembers(people, "김기일").map((hit) => hit.userId),
      ["kim-barista"],
    );
  });

  it("matches a name fragment and a handle without case sensitivity", () => {
    assert.deepEqual(
      searchMembers(people, "정호").map((hit) => hit.userId),
      ["bang"],
    );
    assert.deepEqual(
      searchMembers(people, "JUNGHO").map((hit) => hit.userId),
      ["bang"],
    );
  });

  it("matches a workplace only as part of the public identity text", () => {
    assert.deepEqual(
      searchMembers(people, "홈플러스").map((hit) => hit.userId),
      ["kim-barista"],
    );
  });

  it("drops suspended and blocked accounts and ignores one-character queries", () => {
    assert.deepEqual(searchMembers(people, "paused"), []);
    assert.deepEqual(searchMembers(people, "blocked"), []);
    assert.deepEqual(searchMembers(people, "제"), []);
  });

  it("strips search operators before matching", () => {
    assert.deepEqual(
      searchMembers(people, '  "제니"  ').map((hit) => hit.userId),
      ["jenny"],
    );
  });

  it("sends baristas to the map and other members to the profile", () => {
    const [jenny] = searchMembers(people, "제니");
    const [enthusiast] = searchMembers(people, "시은");

    assert.equal(jenny?.href, "/map?barista=jenny");
    assert.equal(enthusiast?.href, "/profile/enthusiast");
  });
});

describe("baristaIdFromMapSearch", () => {
  it("reads the barista selected from integrated search", () => {
    assert.equal(baristaIdFromMapSearch("?barista=jenny"), "jenny");
    assert.equal(baristaIdFromMapSearch("barista=a%2Fb"), "a/b");
    assert.equal(baristaIdFromMapSearch(""), null);
    assert.equal(baristaIdFromMapSearch("?barista="), null);
  });
});
