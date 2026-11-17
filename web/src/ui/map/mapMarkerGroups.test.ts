import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMapMarkerGroups,
  selectMapMarkerRepresentative,
} from "./mapMarkerGroups";

describe("buildMapMarkerGroups", () => {
  const profiles = [
    { id: "b", lat: 37.56651, lng: 126.97801 },
    { id: "a", lat: 37.5665, lng: 126.978 },
    { id: "c", lat: 37.6, lng: 127.02 },
  ];

  it("keeps nearby markers separate at low zoom levels", () => {
    const groups = buildMapMarkerGroups(profiles, 12);

    assert.equal(groups.length, 3);
    assert.equal(
      groups.some((group) => group.clustered),
      false,
    );
  });

  it("groups identical coordinates in source order without cluster zoom behavior", () => {
    const groups = buildMapMarkerGroups(
      [
        { id: "b", lat: 37.5665, lng: 126.978 },
        { id: "a", lat: 37.5665, lng: 126.978 },
        { id: "c", lat: 37.6, lng: 127.02 },
      ],
      12,
    );
    const stack = groups.find((group) => group.profiles.length === 2);

    assert.equal(stack?.clustered, false);
    assert.deepEqual(
      stack?.profiles.map((profile) => profile.id),
      ["b", "a"],
    );
  });

  it("counts one person once when the same profile has duplicate pins", () => {
    const groups = buildMapMarkerGroups(
      [
        { id: "kim-pin-1", profileId: "kim", lat: 37.5665, lng: 126.978 },
        { id: "kim-pin-2", profileId: "kim", lat: 37.5665, lng: 126.978 },
        { id: "park-pin", profileId: "park", lat: 37.5665, lng: 126.978 },
      ],
      12,
    );

    assert.equal(groups.length, 1);
    assert.deepEqual(
      groups[0]?.profiles.map((profile) => profile.id),
      ["kim-pin-1", "park-pin"],
    );
  });

  it("groups profiles at the same coordinates even with different or empty workplace names into 1 group", () => {
    const groups = buildMapMarkerGroups(
      [
        {
          id: "kim-pin",
          profileId: "kim",
          workplace: "카페 A",
          lat: 37.5665,
          lng: 126.978,
        },
        {
          id: "park-pin",
          profileId: "park",
          workplace: "카페 B",
          lat: 37.5665,
          lng: 126.978,
        },
        {
          id: "lee-pin",
          profileId: "lee",
          workplace: "",
          lat: 37.5665,
          lng: 126.978,
        },
      ],
      12,
    );

    assert.equal(groups.length, 1);
    assert.deepEqual(
      groups[0]?.profiles.map((profile) => profile.id),
      ["kim-pin", "park-pin", "lee-pin"],
    );
  });

  it("selects the first source-ordered profile with an avatar for a marker", () => {
    const representative = selectMapMarkerRepresentative([
      { id: "first", avatarUrl: undefined },
      { id: "second", avatarUrl: "https://example.com/second.jpg" },
      { id: "third", avatarUrl: "https://example.com/third.jpg" },
    ]);

    assert.equal(representative?.id, "second");
  });

  it("falls back to the first source-ordered profile when no avatar exists", () => {
    const representative = selectMapMarkerRepresentative([
      { id: "first", avatarUrl: undefined },
      { id: "second", avatarUrl: undefined },
    ]);

    assert.equal(representative?.id, "first");
  });
});
