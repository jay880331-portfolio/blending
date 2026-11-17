import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPlaceKey,
  matchShowroomToPlace,
  normalizePlaceName,
} from "./placeGrouping";

describe("placeGrouping", () => {
  it("normalizes place name whitespace and casing", () => {
    assert.equal(normalizePlaceName("  성수   블렌딩  "), "성수 블렌딩");
    assert.equal(normalizePlaceName("Cafe  A"), "cafe a");
  });

  it("builds consistent place keys from name and coordinates", () => {
    const k1 = buildPlaceKey("성수 블렌딩", 37.544612, 127.056001);
    const k2 = buildPlaceKey("  성수   블렌딩 ", 37.544614, 127.056004);
    const k3 = buildPlaceKey("다른 카페", 37.544612, 127.056001);

    assert.equal(k1, k2);
    assert.notEqual(k1, k3);
  });

  it("matches showroom by owner and coordinates first, then owner and storeName", () => {
    const showrooms = [
      {
        id: "sr-1",
        userId: "barista-1",
        storeName: "성수 블렌딩",
        location: { latitude: 37.5446, longitude: 127.056 },
      },
      {
        id: "sr-2",
        userId: "barista-2",
        storeName: "연남 로스터스",
      },
    ];

    const matched1 = matchShowroomToPlace(
      showrooms,
      [{ profileId: "barista-1", lat: 37.5446, lng: 127.056 }],
      "성수 블렌딩",
      37.5446,
      127.056,
    );
    assert.equal(matched1?.id, "sr-1");

    const matched2 = matchShowroomToPlace(
      showrooms,
      [{ profileId: "barista-2", lat: 37.56, lng: 126.92 }],
      "연남 로스터스",
      37.56,
      126.92,
    );
    assert.equal(matched2?.id, "sr-2");

    const unmatched = matchShowroomToPlace(
      showrooms,
      [{ profileId: "barista-3", lat: 37.5, lng: 127.0 }],
      "일반 카페",
      37.5,
      127.0,
    );
    assert.equal(unmatched, null);
  });
});
