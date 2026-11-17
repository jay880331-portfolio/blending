import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  shouldShowCircularCropGuide,
  shouldShowCropAspectPicker,
  shouldShowCropZoomSlider,
} from "./ImageCropEditor";

test("고정 비율 크롭은 프레임을 유지하고 비율 선택기만 숨긴다", () => {
  assert.equal(shouldShowCropAspectPicker("square"), false);
  assert.equal(shouldShowCropAspectPicker(), true);
});

test("크롭은 기본적으로 확대 슬라이더를 표시하고 터치 전용 옵션에서만 숨긴다", () => {
  const source = readFileSync(
    new URL("./ImageCropEditor.tsx", import.meta.url),
    "utf8",
  );

  assert.equal(shouldShowCropZoomSlider(), true);
  assert.equal(shouldShowCropZoomSlider(true), false);
  assert.match(source, /type="range"/);
  assert.match(source, /한 손가락으로 이동 · 두 손가락으로 확대\/축소/);
  assert.match(source, /onPointerDown=\{onPointerDown\}/);
  assert.match(source, /onPointerMove=\{onPointerMove\}/);
});

test("원형 가이드 옵션을 요청하면 정사각형 크롭 위에 원형 미리보기 가이드를 표시한다", () => {
  const source = readFileSync(
    new URL("./ImageCropEditor.tsx", import.meta.url),
    "utf8",
  );

  assert.equal(shouldShowCircularCropGuide(), false);
  assert.equal(shouldShowCircularCropGuide("circle"), true);
  assert.match(source, /shouldShowCircularCropGuide\(cropGuideShape\)/);
  assert.match(source, /rounded-full/);
});
