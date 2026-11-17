import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderBrewGuideImageResponse } from "./brewGuideImage";

describe("brewGuideImage", () => {
  it("renders a valid PNG buffer for both scale=1 and scale=2", async () => {
    const sampleGuide = {
      id: "guide-1",
      storeId: "store-1",
      beanId: "bean-1",
      title: "에티오피아 예가체프 G1",
      filter: {
        doseG: 18,
        grind: "중간-가늘게",
        waterTempC: 93,
        yieldG: 280,
        timeSec: 150,
      },
      espresso: {
        doseG: 19,
        basketG: 20,
        waterTempC: 92,
        yieldG: 38,
        timeSec: 28,
      },
      createdAt: "2026-11-17T00:00:00.000Z",
      updatedAt: "2026-11-17T00:00:00.000Z",
      storeName: "블렌딩 로스터리",
      authorName: "김바리스타",
      authorHandle: "kimbarista",
      beanActive: true,
    };

    const res1 = await renderBrewGuideImageResponse(sampleGuide, {
      showroomUrl: "https://blending.kr/showroom/store-1",
      scale: 1,
    });
    assert.equal(res1.headers.get("content-type"), "image/png");
    const buf1 = Buffer.from(await res1.arrayBuffer());
    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    assert.deepEqual(
      Array.from(buf1.subarray(0, 8)),
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    );

    const res2 = await renderBrewGuideImageResponse(
      { ...sampleGuide, espresso: undefined },
      {
        showroomUrl: "https://blending.kr/showroom/store-1",
        scale: 2,
      },
    );
    const buf2 = Buffer.from(await res2.arrayBuffer());
    assert.ok(buf2.length > buf1.length);
  });
});
