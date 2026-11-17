import type { CareerItem } from "./types";

function careerExperienceYears(career: CareerItem, currentYear: number) {
  if (career.type !== "career") return 0;

  const years = (
    career.year.match(/\d{4}/g) ??
    career.period.match(/\d{4}/g) ??
    []
  ).map(Number);
  const startYear = years[0];
  if (!startYear) return 0;

  const endYear =
    career.year.includes("현재") || career.period.includes("현재")
      ? currentYear
      : (years[1] ?? startYear);

  return Math.max(1, endYear - startYear);
}

export function resolveTotalExperience(
  careers: CareerItem[],
  storedTotalExperience?: string,
  currentYear = new Date().getFullYear(),
) {
  const savedTotalExperience = storedTotalExperience?.trim();
  if (savedTotalExperience) return savedTotalExperience;

  const totalYears = careers.reduce(
    (sum, career) => sum + careerExperienceYears(career, currentYear),
    0,
  );

  return totalYears ? `${totalYears}년차` : undefined;
}
