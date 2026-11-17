import assert from "node:assert/strict";
import { it } from "node:test";
import type { CareerItem, PortfolioItem } from "@/domain/member/types";
import { buildResumeData } from "./resumeData";

const careers: CareerItem[] = [
  {
    id: "career-1",
    type: "career",
    year: "2024",
    period: "현재",
    title: "바리스타",
  },
  {
    id: "award-1",
    type: "award",
    year: "2023",
    period: "",
    title: "대회 수상",
  },
];

const portfolios: PortfolioItem[] = Array.from({ length: 4 }, (_, index) => ({
  id: `portfolio-${index + 1}`,
  title: `포트폴리오 ${index + 1}`,
  createdAt: "2024-01-01",
  summary: "소개",
  imageUrls: [],
}));

it("separates career and award history", () => {
  const resume = buildResumeData({ careers, portfolios });

  assert.deepEqual(
    resume.careers.map((item) => item.id),
    ["career-1"],
  );
  assert.deepEqual(
    resume.awards.map((item) => item.id),
    ["award-1"],
  );
});

it("limits visible portfolios to three", () => {
  const resume = buildResumeData({ careers, portfolios });

  assert.equal(resume.portfolios.length, 3);
});

it("omits private contact without an account", () => {
  const resume = buildResumeData({ careers, portfolios });

  assert.equal(resume.contact.email, undefined);
  assert.equal(resume.contact.phone, undefined);
});

it("includes private contact only from the supplied account", () => {
  const resume = buildResumeData({
    careers: [],
    portfolios: [],
    account: {
      country: "KR",
      identityVerified: true,
      email: "me@example.com",
      phone: "010-0000-0000",
    },
  });

  assert.equal(resume.contact.email, "me@example.com");
  assert.equal(resume.contact.phone, "010-0000-0000");
});

it("omits portfolios when the profile has not made them public", () => {
  const resume = buildResumeData({
    careers: [],
    portfolios,
    showPortfolios: false,
  });

  assert.deepEqual(resume.portfolios, []);
});
