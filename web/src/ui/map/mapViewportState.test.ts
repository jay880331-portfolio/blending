import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findOpenedMapBarista,
  findSearchedMapBaristaLocation,
  findUniqueSearchedMapProfile,
  profilesForMapMarkers,
  resolveOpenedMapProfile,
  shouldCenterMapForLocationRequest,
  shouldShowMapEmptyState,
} from "./mapViewportState";

describe("shouldShowMapEmptyState", () => {
  it("does not show the empty state before map profiles are loaded", () => {
    assert.equal(
      shouldShowMapEmptyState({
        profilesLoaded: false,
        filteredProfileCount: 0,
      }),
      false,
    );
  });

  it("shows the empty state after loading when no profiles match", () => {
    assert.equal(
      shouldShowMapEmptyState({
        profilesLoaded: true,
        filteredProfileCount: 0,
      }),
      true,
    );
  });
});

describe("shouldCenterMapForLocationRequest", () => {
  it("centers startup location requests even when a cached location already exists", () => {
    assert.equal(
      shouldCenterMapForLocationRequest({
        intent: "startup",
        hasKnownUserLocation: true,
      }),
      true,
    );
  });

  it("keeps passive refreshes from moving the map after a known location exists", () => {
    assert.equal(
      shouldCenterMapForLocationRequest({
        intent: "refresh",
        hasKnownUserLocation: true,
      }),
      false,
    );
  });

  it("keeps a searched barista in place until the user recenters", () => {
    assert.equal(
      shouldCenterMapForLocationRequest({
        intent: "startup",
        hasKnownUserLocation: true,
        baristaFocused: true,
      }),
      false,
    );
    assert.equal(
      shouldCenterMapForLocationRequest({
        intent: "recenter",
        hasKnownUserLocation: true,
        baristaFocused: true,
      }),
      true,
    );
  });
});

describe("opened map barista", () => {
  const jenny = {
    id: "jenny-pin",
    profileId: "jenny",
    name: "제니",
    lat: 37.5,
    lng: 127.0,
  };

  it("opens the marker popup for the barista chosen in search", () => {
    const opened = findOpenedMapBarista([jenny], "jenny");

    assert.equal(opened, jenny);
    assert.equal(resolveOpenedMapProfile(opened, []), jenny);
    assert.deepEqual(profilesForMapMarkers([], opened), [jenny]);
  });

  it("keeps the visible pin copy when search filters already include it", () => {
    const visible = { ...jenny, name: "제니 최신" };

    assert.equal(resolveOpenedMapProfile(jenny, [visible]), visible);
    assert.deepEqual(profilesForMapMarkers([visible], jenny), [visible]);
  });

  it("ignores a searched barista who has no map coordinates", () => {
    assert.equal(
      findOpenedMapBarista([{ ...jenny, lat: Number.NaN, lng: 127 }], "jenny"),
      null,
    );
  });
});

describe("directory selection location", () => {
  const firstShop = {
    id: "jongjin-pin-1",
    profileId: "jongjin",
    name: "이종진",
    workplace: "블렌딩 커피",
    address: "서울 종로구 블렌딩로 1",
    lat: 37.2,
    lng: 127.9,
  };
  const secondShop = {
    id: "jongjin-pin-2",
    profileId: "jongjin",
    name: "이종진",
    workplace: "라떼커피랩",
    address: "서울 마포구 라떼로 2",
    lat: 37.3,
    lng: 126.9,
  };

  it("opens the workplace that matches the cafe search", () => {
    assert.equal(
      findSearchedMapBaristaLocation(
        [firstShop, secondShop],
        "jongjin",
        "라떼커피랩",
      ),
      secondShop,
    );
    assert.equal(
      findSearchedMapBaristaLocation(
        [firstShop, secondShop],
        "jongjin",
        "이종진 라떼커피랩",
      ),
      secondShop,
    );
    assert.equal(
      findSearchedMapBaristaLocation(
        [firstShop, secondShop],
        "jongjin",
        "블렌딩 커피 서울 종로구",
      ),
      firstShop,
    );
    assert.equal(
      findSearchedMapBaristaLocation(
        [firstShop, secondShop],
        "jongjin",
        "라떼커피랩 서울 마포구",
      ),
      secondShop,
    );
    assert.equal(
      findSearchedMapBaristaLocation(
        [firstShop, secondShop],
        "jongjin",
        "  이종진   라떼커피랩   서울 마포구 ",
      ),
      secondShop,
    );
  });

  it("falls back to the first workplace for a name search or empty query", () => {
    assert.equal(
      findSearchedMapBaristaLocation(
        [firstShop, secondShop],
        "jongjin",
        "이종진",
      ),
      firstShop,
    );
    assert.equal(
      findSearchedMapBaristaLocation([firstShop, secondShop], "jongjin", ""),
      firstShop,
    );
  });

  it("returns null for a profile without coordinates", () => {
    assert.equal(
      findSearchedMapBaristaLocation(
        [{ ...firstShop, lat: Number.NaN }],
        "jongjin",
        "블렌딩",
      ),
      null,
    );
  });
});

describe("map search target", () => {
  const jongjin = {
    id: "jongjin-pin",
    profileId: "jongjin",
    name: "이종진",
    handle: "jongjin",
    lat: 37.2,
    lng: 127.9,
  };
  const other = {
    id: "other-pin",
    profileId: "other",
    name: "다른 사람",
    handle: "other",
    lat: 37.6,
    lng: 127.0,
  };

  it("moves to the one barista matched by the map search", () => {
    assert.equal(
      findUniqueSearchedMapProfile([jongjin, other], "이종진"),
      jongjin,
    );
  });

  it("keeps the map still when the query matches several people", () => {
    assert.equal(
      findUniqueSearchedMapProfile(
        [jongjin, { ...other, name: "이종진" }],
        "이종진",
      ),
      null,
    );
  });

  it("uses the first shop when one barista has two pins", () => {
    const secondShop = { ...jongjin, id: "jongjin-pin-2", lat: 37.3 };

    assert.equal(
      findUniqueSearchedMapProfile([jongjin, secondShop], "종진"),
      jongjin,
    );
  });

  it("prefers an exact name over another profile that only mentions it", () => {
    const exact = { ...jongjin, handle: "cafe" };

    assert.equal(findUniqueSearchedMapProfile([other, exact], "이종진"), exact);
  });

  it("ignores an empty query and a pin without coordinates", () => {
    assert.equal(findUniqueSearchedMapProfile([jongjin], "  "), null);
    assert.equal(
      findUniqueSearchedMapProfile([{ ...jongjin, lat: Number.NaN }], "이종진"),
      null,
    );
  });
});
