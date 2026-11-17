import type { MemberProfile } from "@/domain/member/types";
import { activeAccountFilter } from "@/infrastructure/server/accountStatus";
import type { UserDocument } from "@/infrastructure/server/auth";

export type DirectoryProfile = {
  profileId: string;
  name: string;
  workplace: string;
  workplaces: string[];
  addresses: string[];
  bio: string;
  avatarUrl?: string;
  handle: string;
  role: "barista";
  skills: string[];
  badgeName?: string;
};

export function directoryUserFilter() {
  return { role: "barista" as const, ...activeAccountFilter() };
}

export function directoryProfileFromUser(
  user: UserDocument,
  profile?: MemberProfile,
  badgeName?: string,
): DirectoryProfile {
  const avatarUrl = profile?.avatarUrl ?? user.avatarUrl;
  const workplaceLocations = [
    ...(profile?.workplaceLocations ?? []),
    ...(user.workplaceLocations ?? []),
  ].map((location) => ({
    name: location.name.trim(),
    address: location.address.trim(),
  }));
  const primaryWorkplace =
    profile?.workplace.trim() ||
    user.workplaces.map((workplace) => workplace.trim()).find(Boolean) ||
    workplaceLocations.map((location) => location.name).find(Boolean) ||
    "";
  const locationNames = workplaceLocations.map((location) => location.name);
  const addresses = workplaceLocations.map((location) => location.address);
  const extraWorkplaces = uniqueTextValues([
    primaryWorkplace,
    ...(profile?.workplaces ?? []),
    ...user.workplaces,
  ]).filter((workplace) => !locationNames.includes(workplace));
  const workplaces = [...locationNames, ...extraWorkplaces];

  return {
    profileId: user.id,
    name: profile?.name ?? user.name,
    workplace: primaryWorkplace || workplaces.find(Boolean) || "",
    workplaces,
    addresses,
    bio: profile?.bio.trim() ?? "",
    ...(avatarUrl ? { avatarUrl } : {}),
    handle: profile?.handle ?? user.handle ?? user.id,
    role: "barista",
    skills: profile?.specialties.length
      ? profile.specialties
      : user.specialties,
    ...(badgeName ? { badgeName } : {}),
  };
}

function uniqueTextValues(values: Array<string | undefined>) {
  const seen = new Set<string>();
  const uniqueValues: string[] = [];

  values.forEach((value) => {
    const text = value?.trim() ?? "";
    if (!text || seen.has(text)) return;
    seen.add(text);
    uniqueValues.push(text);
  });

  return uniqueValues;
}
