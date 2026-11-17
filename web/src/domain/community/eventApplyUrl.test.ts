import assert from "node:assert/strict";
import test from "node:test";
import { isCleartextHttpUrl, normalizeEventApplyUrl } from "./eventApplyUrl";

test("이벤트 신청 링크는 프로토콜 없는 도메인을 https URL로 정규화한다", () => {
  assert.equal(
    normalizeEventApplyUrl("apply.blending.example/form"),
    "https://apply.blending.example/form",
  );
  assert.equal(
    normalizeEventApplyUrl("http://apply.blending.example"),
    "http://apply.blending.example/",
  );
  assert.equal(normalizeEventApplyUrl("  "), undefined);
});

test("평문 http 신청 링크만 기기 브라우저로 연다", () => {
  assert.equal(isCleartextHttpUrl("http://apply.blending.example/form"), true);
  assert.equal(
    isCleartextHttpUrl("https://apply.blending.example/form"),
    false,
  );
  assert.equal(isCleartextHttpUrl("javascript:alert(1)"), false);
});

test("이벤트 신청 링크는 유효하지 않거나 허용하지 않는 프로토콜을 거부한다", () => {
  assert.equal(normalizeEventApplyUrl("javascript:alert(1)"), null);
  assert.equal(normalizeEventApplyUrl("https://"), null);
});
