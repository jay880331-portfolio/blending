import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBrewGuideInput } from "./brewGuide";

describe("brewGuide domain validation", () => {
  it("accepts valid filter-only, espresso-only, and combined brew guides", () => {
    const filterOnly = parseBrewGuideInput({
      title: "에티오피아 예가체프",
      beanId: "bean-1",
      filter: {
        doseG: 18,
        grind: "중간-가늘게",
        waterTempC: 93,
        yieldG: 280,
        timeSec: 150,
      },
    });
    assert.equal(filterOnly.ok, true);
    if (filterOnly.ok) {
      assert.equal(filterOnly.value.beanId, "bean-1");
      assert.equal(filterOnly.value.espresso, undefined);
    }

    const espressoOnly = parseBrewGuideInput({
      title: "시그니처 블렌드",
      beanId: null,
      espresso: {
        doseG: 19.5,
        basketG: 20,
        waterTempC: 92,
        yieldG: 38,
        timeSec: 28,
      },
    });
    assert.equal(espressoOnly.ok, true);
    if (espressoOnly.ok) {
      assert.equal(espressoOnly.value.beanId, null);
      assert.equal(espressoOnly.value.filter, undefined);
    }
  });

  it("rejects missing both recipes, overlong title/grind, and out-of-range numbers", () => {
    assert.equal(
      parseBrewGuideInput({ title: "원두", beanId: null }).ok,
      false,
    );
    assert.equal(
      parseBrewGuideInput({
        title: "가".repeat(41),
        filter: {
          doseG: 18,
          grind: "중간",
          waterTempC: 92,
          yieldG: 250,
          timeSec: 120,
        },
      }).ok,
      false,
    );
    assert.equal(
      parseBrewGuideInput({
        title: "원두",
        filter: {
          doseG: 4, // < 5
          grind: "중간",
          waterTempC: 92,
          yieldG: 250,
          timeSec: 120,
        },
      }).ok,
      false,
    );
    assert.equal(
      parseBrewGuideInput({
        title: "원두",
        filter: {
          doseG: 18,
          grind: "가".repeat(21), // > 20
          waterTempC: 92,
          yieldG: 250,
          timeSec: 120,
        },
      }).ok,
      false,
    );
    assert.equal(
      parseBrewGuideInput({
        title: "원두",
        espresso: {
          doseG: 18,
          basketG: 31, // > 30
          waterTempC: 92,
          yieldG: 38,
          timeSec: 28,
        },
      }).ok,
      false,
    );
    assert.equal(
      parseBrewGuideInput({
        title: "원두",
        espresso: {
          doseG: 18,
          basketG: 20,
          waterTempC: 101, // > 100
          yieldG: 38,
          timeSec: 28,
        },
      }).ok,
      false,
    );
    assert.equal(
      parseBrewGuideInput({
        title: "원두",
        filter: {
          doseG: 18,
          grind: "중간",
          waterTempC: 92,
          yieldG: 601, // > 600
          timeSec: 120,
        },
      }).ok,
      false,
    );
    assert.equal(
      parseBrewGuideInput({
        title: "원두",
        filter: {
          doseG: 18,
          grind: "중간",
          waterTempC: 92,
          yieldG: 250,
          timeSec: 9, // < 10
        },
      }).ok,
      false,
    );
  });
});
