import assert from "node:assert/strict";
import test from "node:test";

test("경력 추가 진입은 경력 전용 화면 정보를 제공한다", async () => {
  const homeApp = await import("./HomeApp");

  assert.equal(typeof homeApp.getCareerEditMode, "function");
  assert.deepEqual(homeApp.getCareerEditMode("career"), {
    type: "career",
    title: "경력 추가",
  });
});

test("수상 추가 진입은 수상 전용 화면 정보를 제공한다", async () => {
  const homeApp = await import("./HomeApp");

  assert.equal(typeof homeApp.getCareerEditMode, "function");
  assert.deepEqual(homeApp.getCareerEditMode("award"), {
    type: "award",
    title: "수상 추가",
  });
});
