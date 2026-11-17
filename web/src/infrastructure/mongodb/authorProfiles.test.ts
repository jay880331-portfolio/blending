import assert from "node:assert/strict";
import { resolveAuthorAvatar } from "@/infrastructure/mongodb/authorProfiles";

const lookupWithOwner = {
  byOwnerId: new Map([["member-1", "/profiles/member-1.webp"]]),
  byName: new Map([["민지", "/profiles/minji.webp"]]),
};

assert.equal(
  resolveAuthorAvatar(lookupWithOwner, { ownerId: "member-1", name: "민지" }),
  "/profiles/member-1.webp",
);

const lookupWithNameOnly = {
  byOwnerId: new Map<string, string>(),
  byName: new Map([
    ["민지", "/profiles/minji.webp"],
    ["minji", "/profiles/minji.webp"],
  ]),
};

assert.equal(
  resolveAuthorAvatar(lookupWithNameOnly, { name: "민지" }),
  "/profiles/minji.webp",
);
assert.equal(
  resolveAuthorAvatar(lookupWithNameOnly, { name: "없는 이름" }),
  undefined,
);
assert.equal(
  resolveAuthorAvatar(lookupWithNameOnly, { name: "minji" }),
  "/profiles/minji.webp",
);
