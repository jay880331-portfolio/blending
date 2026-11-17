import assert from "node:assert/strict";
import test from "node:test";
import {
  PROHIBITED_PUBLIC_CONTENT,
  normalizePublicText,
  prohibitedPublicContent,
} from "./ugcModeration";

test("public UGC moderation allows ordinary text and catches normalized bypasses", () => {
  assert.equal(prohibitedPublicContent("맛있는 원두 후기입니다."), null);
  assert.equal(prohibitedPublicContent("한남동 카페 추천"), null);
  assert.equal(prohibitedPublicContent("죽여주는 맛"), null);
  assert.equal(prohibitedPublicContent("snigger doodle"), null);
  assert.deepEqual(
    prohibitedPublicContent("you are a nigger"),
    PROHIBITED_PUBLIC_CONTENT,
  );
  assert.deepEqual(
    prohibitedPublicContent("kill yourself now"),
    PROHIBITED_PUBLIC_CONTENT,
  );
  assert.deepEqual(
    prohibitedPublicContent("너를 죽여 버릴거야"),
    PROHIBITED_PUBLIC_CONTENT,
  );
  assert.equal(
    normalizePublicText(" K!I L L  Y-O-U-R-S-E-L-F "),
    "killyourself",
  );
  assert.deepEqual(
    prohibitedPublicContent("K!I L L  Y-O-U-R-S-E-L-F"),
    PROHIBITED_PUBLIC_CONTENT,
  );
  assert.deepEqual(
    prohibitedPublicContent("조건 만남 구해요"),
    PROHIBITED_PUBLIC_CONTENT,
  );
  assert.deepEqual(
    prohibitedPublicContent("Sell drugs here"),
    PROHIBITED_PUBLIC_CONTENT,
  );
  assert.deepEqual(
    prohibitedPublicContent("너를 죽여"),
    PROHIBITED_PUBLIC_CONTENT,
  );
  assert.deepEqual(
    prohibitedPublicContent("n!igger"),
    PROHIBITED_PUBLIC_CONTENT,
  );
});
