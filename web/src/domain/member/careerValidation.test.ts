import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasCompleteCareerRequiredFields,
  hasMeaningfulCareerText,
  normalizeAwardYear,
  normalizeCareerYear,
  validateCareerDraft,
  validateCareerDrafts,
} from "./careerValidation";

const validAward = {
  id: "award-1",
  type: "award" as const,
  year: "2025",
  title: "KNBC 1위",
  organization: "한국커피협회",
  detail: "대회 결선에서 시그니처 메뉴를 발표했습니다.",
};

describe("normalizeCareerYear", () => {
  it("normalizes year-like input to a YYYY ~ YYYY period", () => {
    assert.equal(normalizeCareerYear("20ab26년"), "2026 ~ 2026");
    assert.equal(normalizeCareerYear("2025.01 - 2026.12"), "2025 ~ 2026");
  });
});

describe("normalizeAwardYear", () => {
  it("normalizes year-like input to a single YYYY value", () => {
    assert.equal(normalizeAwardYear("2025.01 - 2026.12"), "2025");
    assert.equal(normalizeAwardYear("20ab26년"), "2026");
  });
});

describe("hasCompleteCareerRequiredFields", () => {
  it("allows an empty draft list and complete required field selections", () => {
    assert.equal(hasCompleteCareerRequiredFields([]), true);
    assert.equal(hasCompleteCareerRequiredFields([validAward]), true);
    assert.equal(
      hasCompleteCareerRequiredFields([
        { ...validAward, type: "career", year: "2024 ~ 2025" },
      ]),
      true,
    );
    assert.equal(
      hasCompleteCareerRequiredFields([
        { ...validAward, type: "career", year: "2024 ~ 현재" },
      ]),
      true,
    );
  });

  it("requires non-blank text and fully selected years", () => {
    assert.equal(
      hasCompleteCareerRequiredFields([{ ...validAward, title: "  " }]),
      false,
    );
    assert.equal(
      hasCompleteCareerRequiredFields([{ ...validAward, organization: "  " }]),
      false,
    );
    assert.equal(
      hasCompleteCareerRequiredFields([{ ...validAward, year: "2025 ~ 2026" }]),
      false,
    );
    assert.equal(
      hasCompleteCareerRequiredFields([
        { ...validAward, type: "career", year: "2025" },
      ]),
      false,
    );
  });

  it("does not block semantic validation errors once required fields are complete", () => {
    assert.equal(
      hasCompleteCareerRequiredFields([
        {
          ...validAward,
          id: "career-1",
          type: "career",
          year: "2026 ~ 2025",
          title: "222",
          organization: "222",
        },
        {
          ...validAward,
          id: "career-2",
          type: "career",
          year: "2023 ~ 2024",
        },
      ]),
      true,
    );
    assert.equal(
      hasCompleteCareerRequiredFields([
        {
          ...validAward,
          id: "career-1",
          type: "career",
          year: "2019 ~ 2026",
          title: "222",
          organization: "222",
        },
        {
          ...validAward,
          id: "career-2",
          type: "career",
          year: "2023 ~ 2024",
        },
      ]),
      true,
    );
  });
});

describe("validateCareerDraft", () => {
  it("requires a YYYY to YYYY period for careers", () => {
    assert.equal(
      validateCareerDraft({ ...validAward, type: "career", year: "22" }),
      "연도는 YYYY ~ YYYY 형식의 기간으로 선택해주세요.",
    );
  });

  it("requires a single YYYY value for awards", () => {
    assert.equal(
      validateCareerDraft({ ...validAward, year: "2025 ~ 2026" }),
      "수상 연도는 YYYY 형식으로 선택해주세요.",
    );
  });

  it("rejects career periods where the start year is after the end year", () => {
    assert.equal(
      validateCareerDraft({
        ...validAward,
        type: "career",
        year: "2026 ~ 2025",
      }),
      "시작 연도는 종료 연도보다 늦을 수 없습니다.",
    );
  });

  it("rejects numeric-only required text", () => {
    assert.equal(hasMeaningfulCareerText("222"), false);
    assert.equal(
      validateCareerDraft({
        ...validAward,
        title: "222",
        organization: "222",
      }),
      "수상명과 수상 기관은 의미 있는 내용으로 입력해주세요.",
    );
  });

  it("rejects meaningless detail text when provided", () => {
    assert.equal(
      validateCareerDraft({ ...validAward, detail: "ㅋㅋㅋㅋ" }),
      "상세 성과는 의미 있는 내용으로 입력해주세요.",
    );
  });

  it("accepts normal award content", () => {
    assert.equal(validateCareerDraft(validAward), null);
  });
});

describe("validateCareerDrafts", () => {
  it("rejects overlapping career periods", () => {
    assert.equal(
      validateCareerDrafts([
        {
          ...validAward,
          id: "career-1",
          type: "career",
          year: "2019 ~ 2026",
          title: "헤드 바리스타",
          organization: "블렌딩",
        },
        {
          ...validAward,
          id: "career-2",
          type: "career",
          year: "2023 ~ 2024",
          title: "점장",
          organization: "커피바",
        },
      ]),
      "경력 기간이 겹칩니다. 기간이 겹치지 않도록 수정해주세요.",
    );
  });

  it("accepts non-overlapping career periods and awards in the same years", () => {
    assert.equal(
      validateCareerDrafts([
        {
          ...validAward,
          id: "career-1",
          type: "career",
          year: "2019 ~ 2022",
          title: "바리스타",
          organization: "블렌딩",
        },
        {
          ...validAward,
          id: "award-2",
          type: "award",
          year: "2021",
          title: "커피 대회 1위",
          organization: "한국커피협회",
        },
        {
          ...validAward,
          id: "career-2",
          type: "career",
          year: "2023 ~ 2026",
          title: "헤드 바리스타",
          organization: "커피바",
        },
      ]),
      null,
    );
  });
});
