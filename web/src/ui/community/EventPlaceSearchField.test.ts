import assert from "node:assert/strict";
import { test } from "node:test";
import { getEventPlaceInitialQuery } from "./EventPlaceSearchField";

test("기존 장소가 미정이면 주소를 검색어로 보여준다", () => {
  assert.equal(
    getEventPlaceInitialQuery(
      "장소 미정",
      "경기 수원시 권선구 세화로134번길 37",
    ),
    "경기 수원시 권선구 세화로134번길 37",
  );
});

test("등록된 장소명이 있으면 장소명을 검색어로 보여준다", () => {
  assert.equal(
    getEventPlaceInitialQuery(
      "수원 메쎄",
      "경기 수원시 권선구 세화로134번길 37",
    ),
    "수원 메쎄",
  );
});
