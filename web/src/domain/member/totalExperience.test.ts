import assert from "node:assert/strict";
import test from "node:test";
import { resolveTotalExperience } from "./totalExperience";

test("저장된 총경력 값은 계산값보다 우선한다", () => {
  assert.equal(
    resolveTotalExperience(
      [
        {
          id: "career-1",
          type: "career",
          year: "2019 ~ 현재",
          period: "2019 ~ 현재",
          title: "바리스타",
        },
      ],
      "10년차",
      2026,
    ),
    "10년차",
  );
});

test("올해 시작한 현재 경력은 1년차로 계산한다", () => {
  assert.equal(
    resolveTotalExperience(
      [
        {
          id: "career-current-year",
          type: "career",
          year: "2026 ~ 현재",
          period: "2026 ~ 현재",
          title: "바리스타",
        },
        {
          id: "award-1",
          type: "award",
          year: "2010",
          period: "2010",
          title: "수상",
        },
      ],
      "",
      2026,
    ),
    "1년차",
  );
});

test("2019년부터 현재까지의 경력은 7년차로 계산한다", () => {
  assert.equal(
    resolveTotalExperience(
      [
        {
          id: "career-2019",
          type: "career",
          year: "2019 ~ 현재",
          period: "2019 ~ 현재",
          title: "바리스타",
        },
      ],
      undefined,
      2026,
    ),
    "7년차",
  );
});
