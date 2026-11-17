import type {
  CareerItem,
  MemberProfile,
  PortfolioItem,
  StatusMessage,
} from "@/domain/member/types";
import { cookies } from "next/headers";
import { getMongoDb, toDomain } from "@/infrastructure/mongodb/client";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { profileWithUserDefaults } from "@/infrastructure/mongodb/memberMongoRepository";
import {
  getUserFromSessionToken,
  SESSION_COOKIE,
  type UserDocument,
} from "@/infrastructure/server/auth";
import { activeAccountFilter } from "@/infrastructure/server/accountStatus";
import { hasAdminRole } from "@/infrastructure/server/authRole";
import { UserBlockMongoRepository } from "@/infrastructure/mongodb/userBlockMongoRepository";
import { profileBadgeMongoRepository } from "@/infrastructure/mongodb/profileBadgeMongoRepository";

type ProfileDocument = MemberProfile & { ownerId?: string };
type CareerDocument = CareerItem & { ownerId?: string };
type PortfolioDocument = PortfolioItem & { ownerId?: string };

export type PublicProfileData = {
  ownerId: string;
  profile: MemberProfile;
  careers: CareerItem[];
  portfolios: PortfolioItem[];
};

export async function getPublicProfileData(
  id: string,
): Promise<PublicProfileData | null> {
  await ensureMongoIndexes();

  const db = await getMongoDb();
  const profiles = db.collection<ProfileDocument>("member_profiles");
  const profileDocument =
    (await profiles.findOne({ ownerId: id })) ??
    (await profiles.findOne({ id }));

  const ownerId = profileDocument?.ownerId ?? profileDocument?.id ?? id;
  const owner = await db
    .collection<UserDocument>("users")
    .findOne({ id: ownerId, ...activeAccountFilter() });
  if (!owner) return null;
  const viewer = await currentProfileViewer();
  if (
    viewer &&
    canViewPublicProfile(
      viewer,
      await new UserBlockMongoRepository().isBlocked(viewer.id, ownerId),
    ) === false
  )
    return null;
  const profile = profileDocument
    ? profileWithUserDefaults(toDomain(profileDocument), owner)
    : await getFallbackProfile(ownerId);
  if (!profile) return null;

  const [careers, portfolios, officialBadges] = await Promise.all([
    db
      .collection<CareerDocument>("member_careers")
      .find({ ownerId })
      .sort({ year: -1 })
      .toArray(),
    profile.isPortfolioPublic
      ? db
          .collection<PortfolioDocument>("member_portfolios")
          .find({ ownerId })
          .sort({ createdAt: -1 })
          .toArray()
      : Promise.resolve([]),
    profileBadgeMongoRepository.listForOwner(ownerId),
  ]);

  const isOwnProfile = isViewerProfile(viewer, ownerId);

  return {
    ownerId,
    profile: {
      ...sanitizePublicProfile(profile, isOwnProfile),
      officialBadges,
      isOwnProfile,
    },
    careers: careers.map((career) => toDomain(career)),
    portfolios: portfolios.map((portfolio) => toDomain(portfolio)),
  };
}

export function sanitizePublicProfile<T extends { passport?: unknown }>(
  profile: T,
  isOwnProfile: boolean,
): T {
  if (isOwnProfile) return profile;
  const copy = { ...profile };
  delete copy.passport;
  return copy;
}

export function canViewPublicProfile(
  viewer: Pick<UserDocument, "role">,
  blocked: boolean,
) {
  return !blocked || hasAdminRole(viewer);
}

export function isViewerProfile(
  viewer: Pick<UserDocument, "id"> | null,
  ownerId: string,
) {
  return viewer?.id === ownerId;
}

async function currentProfileViewer() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? getUserFromSessionToken(token) : null;
}

async function getFallbackProfile(
  ownerId: string,
): Promise<MemberProfile | null> {
  const db = await getMongoDb();
  const user = await db
    .collection<UserDocument>("users")
    .findOne({ id: ownerId, ...activeAccountFilter() });
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    handle: user.handle ?? user.id,
    role: user.role,
    avatarUrl: user.avatarUrl,
    online: true,
    status: "guest" satisfies StatusMessage,
    workplace: user.workplaces[0] ?? "",
    workplaces: user.workplaces,
    workplaceLocations: user.workplaceLocations,
    specialties: user.specialties,
    bio: "",
    favoriteCount: 0,
    isPortfolioPublic: false,
    certificateName: "",
    officialBadges: [],
    baristaProfile: undefined,
    isOwnProfile: false,
    socials: user.socials,
  };
}

export async function getPublicPortfolioData(
  profileId: string,
  portfolioId: string,
) {
  const data = await getPublicProfileData(profileId);
  if (!data) return null;

  const portfolio = data.portfolios.find((item) => item.id === portfolioId);
  if (!portfolio) return null;

  return { ...data, portfolio };
}
