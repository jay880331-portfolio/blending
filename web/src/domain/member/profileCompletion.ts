import type { MemberAccountInfo, MemberProfile } from "./types";

type ProfileCompletion = {
  score: number;
  missing: string[];
};

const isFilled = (value: string | undefined) => Boolean(value?.trim());

export function getProfileCompletion(
  profile: MemberProfile,
  account?: MemberAccountInfo,
): ProfileCompletion {
  const baristaProfile = profile.baristaProfile;
  const fields =
    profile.role === "enthusiast"
      ? ([
          ["프로필 사진", 15, isFilled(profile.avatarUrl)],
          ["닉네임", 15, isFilled(profile.handle)],
          ["활동 지역", 15, isFilled(profile.activityRegion)],
          ["자기소개", 15, isFilled(profile.bio)],
          ["취향 키워드", 15, profile.specialties.some(isFilled)],
          [
            "원두 뉘앙스",
            15,
            Boolean(baristaProfile?.preferredBeanNotes?.some(isFilled)),
          ],
          [
            "소셜",
            10,
            isFilled(profile.socials.instagram) ||
              isFilled(profile.socials.threads) ||
              isFilled(profile.socials.website),
          ],
        ] as const)
      : ([
          ["프로필 사진", 10, isFilled(profile.avatarUrl)],
          ["이름", 10, isFilled(profile.name)],
          ["닉네임", 5, isFilled(profile.handle)],
          [
            "연락처",
            10,
            isFilled(account?.phone) || isFilled(baristaProfile?.contactPhone),
          ],
          [
            "소속",
            10,
            isFilled(profile.workplace) || profile.workplaces.some(isFilled),
          ],
          ["전문분야", 10, profile.specialties.some(isFilled)],
          ["자기소개", 10, isFilled(profile.bio)],
          [
            "에스프레소 머신 브랜드",
            7,
            baristaProfile?.espressoMachineBrands.some(isFilled) ||
              isFilled(baristaProfile?.espressoMachineBrandOther),
          ],
          [
            "그라인더 브랜드",
            7,
            baristaProfile?.grinderBrands.some(isFilled) ||
              isFilled(baristaProfile?.grinderBrandOther),
          ],
          ["선호 원두", 7, isFilled(baristaProfile?.preferredBeans)],
          ["원두 뉘앙스", 7, baristaProfile?.preferredBeanNotes.some(isFilled)],
          [
            "소셜",
            7,
            isFilled(profile.socials.instagram) ||
              isFilled(profile.socials.threads) ||
              isFilled(profile.socials.website),
          ],
        ] as const);

  return fields.reduce<ProfileCompletion>(
    (result, [label, weight, complete]) => {
      if (complete) result.score += weight;
      else result.missing.push(label);
      return result;
    },
    { score: 0, missing: [] },
  );
}
