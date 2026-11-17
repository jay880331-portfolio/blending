export const BARISTA_SPECIALTIES = [
  {
    value: "에스프레소",
    label: "에스프레소",
    aliases: ["에스프레소", "espresso"],
  },
  {
    value: "라떼아트",
    label: "라떼아트",
    aliases: ["라떼아트", "latte art", "latte"],
  },
  {
    value: "브루잉",
    label: "브루잉",
    aliases: ["브루잉", "brewing", "brew", "핸드드립"],
  },
  {
    value: "로스팅",
    label: "로스팅",
    aliases: ["로스팅", "roasting", "roast"],
  },
  {
    value: "코칭/심사",
    label: "코칭/심사",
    aliases: ["코칭/심사", "코칭", "심사", "coaching", "judge", "judging"],
  },
] as const;

export type BaristaSpecialty = (typeof BARISTA_SPECIALTIES)[number]["value"];

export function normalizeSpecialtyToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s/]+/g, "");
}

export function normalizeBaristaSpecialties(skills: string[]) {
  const normalizedSkills = skills.map(normalizeSpecialtyToken);
  const knownSpecialtyTokens = BARISTA_SPECIALTIES.flatMap((specialty) =>
    specialty.aliases.map(normalizeSpecialtyToken),
  );
  const customSkills = skills
    .map((skill) => skill.trim())
    .filter((skill) => {
      if (!skill) return false;
      return !knownSpecialtyTokens.includes(normalizeSpecialtyToken(skill));
    });

  const knownSkills = BARISTA_SPECIALTIES.flatMap((specialty) =>
    normalizedSkills.some((skill) =>
      specialty.aliases.some(
        (alias) => skill === normalizeSpecialtyToken(alias),
      ),
    )
      ? [specialty.value]
      : [],
  );

  return [...knownSkills, ...new Set(customSkills)];
}

export function normalizeDefaultBaristaSpecialties(skills: string[]) {
  return normalizeBaristaSpecialties(skills).filter(
    (skill): skill is BaristaSpecialty =>
      BARISTA_SPECIALTIES.some((specialty) => specialty.value === skill),
  );
}
