import type { MemberProfile, MemberRole } from "@/domain/member/types";

export type HomeHeaderTone = "accent" | "fg";

/** 공개 프로필도 variant home을 쓰므로, 역할 명함은 로그인 홈에서만 연다. */
export function loggedInHomeCard(input: {
  variant: "default" | "home";
  selfHome: boolean;
  role: MemberRole;
}): { header: HomeHeaderTone; enthusiastLayout: boolean } {
  if (input.variant !== "home" || !input.selfHome) {
    return { header: "fg", enthusiastLayout: false };
  }

  return {
    header: "fg",
    enthusiastLayout: input.role === "enthusiast",
  };
}

export function homeShowsProfessionalSections(role: MemberRole): boolean {
  return role !== "enthusiast";
}

/** 애호가 저장은 숨긴 소속·자격·장비를 보내지 않아 저장된 값을 유지한다. */
export function profileEditKeepsStoredProfession(role: MemberRole): boolean {
  return role === "enthusiast";
}

export function profileEditCanSave(input: {
  role: MemberRole;
  name: string;
  nickname: string;
  skillCount: number;
  hasWorkplace: boolean;
}): boolean {
  if (!input.name.trim() || !input.nickname.trim()) return false;
  if (input.role === "enthusiast") return true;
  return input.skillCount > 0 && input.hasWorkplace;
}

const registeredOr = (value: string | undefined) => {
  const text = value?.trim() ?? "";
  return text || "등록 전";
};

export function enthusiastHomeCard(profile: MemberProfile) {
  return {
    nickname: registeredOr(profile.handle),
    activityRegion: registeredOr(profile.activityRegion),
    bio: registeredOr(profile.bio),
    keywords: profile.specialties.map((item) => item.trim()).filter(Boolean),
    nuances:
      profile.baristaProfile?.preferredBeanNotes
        .map((item) => item.trim())
        .filter(Boolean) ?? [],
    instagram: profile.socials.instagram,
    threads: profile.socials.threads,
    website: profile.socials.website,
  };
}
