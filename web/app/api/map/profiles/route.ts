import type {
  FavoriteProfile,
  MemberProfile,
  PortfolioItem,
  WorkplaceLocation,
} from "@/domain/member/types";
import {
  calculateAvailablePoints,
  canStoreRunPassport,
} from "@/domain/passport/ledger";
import type {
  CoffeePassport,
  StoreTasteProfile,
} from "@/domain/passport/passport";
import {
  getActiveStatusNotice,
  type ShowroomStatusNotice,
} from "@/domain/showroom/statusNotice";
import { isActiveTimesaleCoupon } from "@/domain/showroom/timesaleActive";
import type { ShowroomBean } from "@/domain/showroom/bean";
import type {
  BaristaShowroom,
  ShowroomCoupon,
  ShowroomLocation,
  ShowroomMenu,
} from "@/domain/showroom/types";
import {
  getActiveLedgerEntries,
  type PassportStampDoc,
} from "@/infrastructure/server/passportRepository";
import { getMongoDb, toDomain } from "@/infrastructure/mongodb/client";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import {
  getCurrentUser,
  type UserDocument,
} from "@/infrastructure/server/auth";
import { canSendMapMessage } from "@/infrastructure/server/authRole";
import { jsonError } from "@/infrastructure/server/http";
import { activeAccountFilter } from "@/infrastructure/server/accountStatus";
import type { NextRequest } from "next/server";
import { UserBlockMongoRepository } from "@/infrastructure/mongodb/userBlockMongoRepository";

type MapProfileResponse = {
  profiles: Array<{
    id: string;
    profileId: string;
    name: string;
    workplace: string;
    address: string;
    avatarUrl?: string;
    online: boolean;
    role: MemberProfile["role"];
    handle: string;
    bio: string;
    favoriteCount: number;
    favorited: boolean;
    isOwnProfile: boolean;
    isPortfolioPublic: boolean;
    portfolios: PortfolioItem[];
    skills: string[];
    canMessage: boolean;
    lat: number;
    lng: number;
  }>;
  stores: Array<{
    id: string;
    userId: string;
    storeName: string;
    location?: ShowroomLocation;
    avatarUrl?: string;
    statusNotice?: ShowroomStatusNotice;
    tasteProfile?: StoreTasteProfile;
    favorited: boolean;
    stampCount: number;
    canRedeem: boolean;
    hasActiveBeans: boolean;
    businessVerified: boolean;
    activeTimesaleCoupons: Array<{
      id: string;
      title: string;
      discountDetail: string;
      validUntil: string;
    }>;
  }>;
  viewerPassport: CoffeePassport | null;
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await ensureMongoIndexes();

  const db = await getMongoDb();
  const currentUser = await getCurrentUser(request);
  if (!currentUser) return jsonError("로그인이 필요합니다.", 401);
  const blockedOwnerIds = await new UserBlockMongoRepository().blockedUserIds(
    currentUser.id,
  );

  const users = await db
    .collection<UserDocument>("users")
    .find({
      role: "barista",
      "workplaceLocations.0": { $exists: true },
      ...(blockedOwnerIds.length ? { id: { $nin: blockedOwnerIds } } : {}),
      ...activeAccountFilter(),
    })
    .toArray();

  const profileIds = users.map((user) => user.id);
  const profiles = await db
    .collection<MemberProfile & { ownerId?: string }>("member_profiles")
    .find({ ownerId: { $in: profileIds } }, { projection: { passport: 0 } })
    .toArray();
  const profileByOwnerId = new Map(
    profiles.map((profile) => [profile.ownerId, toDomain(profile)]),
  );
  const [favorites, portfolios, rawShowrooms, viewerProfile] =
    await Promise.all([
      db
        .collection<FavoriteProfile & { ownerId?: string; deletedAt?: string }>(
          "member_favorites",
        )
        .find({ ownerId: currentUser.id, deletedAt: { $exists: false } })
        .toArray(),
      db
        .collection<PortfolioItem & { ownerId?: string }>("member_portfolios")
        .find({ ownerId: { $in: profileIds } })
        .sort({ createdAt: -1 })
        .toArray(),
      db
        .collection<BaristaShowroom>("barista_showrooms")
        .find({ userId: { $in: profileIds } })
        .toArray(),
      db
        .collection<MemberProfile & { ownerId?: string }>("member_profiles")
        .findOne({ ownerId: currentUser.id }, { projection: { passport: 1 } }),
    ]);
  const storeIds = rawShowrooms.map((showroom) => showroom.id);
  const now = new Date();
  const nowIsoStr = now.toISOString();
  const [
    storeFavorites,
    timesaleCoupons,
    userStamps,
    exchangeableMenus,
    activeLedger,
    activeBeans,
  ] = storeIds.length
    ? await Promise.all([
        db
          .collection<{ ownerId: string; storeId: string }>("store_favorites")
          .find(
            { ownerId: currentUser.id, storeId: { $in: storeIds } },
            { projection: { storeId: 1 } },
          )
          .toArray(),
        db
          .collection<ShowroomCoupon>("coupons")
          .find(
            {
              showroomId: { $in: storeIds },
              couponType: "timesale",
              validUntil: { $gte: nowIsoStr },
            },
            {
              projection: {
                id: 1,
                showroomId: 1,
                title: 1,
                discountDetail: 1,
                couponType: 1,
                validFrom: 1,
                validUntil: 1,
                totalLimit: 1,
                issuedCount: 1,
                issuanceStoppedAt: 1,
                policyVersion: 1,
                approvalState: 1,
              },
            },
          )
          .toArray(),
        db
          .collection<PassportStampDoc>("passport_stamps")
          .find(
            { userId: currentUser.id, storeId: { $in: storeIds } },
            { projection: { storeId: 1 } },
          )
          .toArray(),
        db
          .collection<ShowroomMenu>("menus")
          .find(
            { showroomId: { $in: storeIds }, exchangePoints: { $gt: 0 } },
            { projection: { showroomId: 1, exchangePoints: 1 } },
          )
          .toArray(),
        getActiveLedgerEntries(db, currentUser.id, now),
        db
          .collection<ShowroomBean>("showroom_beans")
          .find(
            { storeId: { $in: storeIds }, active: true },
            { projection: { storeId: 1 } },
          )
          .toArray(),
      ])
    : [[], [], [], [], [], []];
  const activeBeanStoreIds = new Set(activeBeans.map((b) => b.storeId));
  const favoritedStoreIds = new Set(storeFavorites.map((fav) => fav.storeId));
  const stampCountByStoreId = new Map<string, number>();
  for (const s of userStamps) {
    stampCountByStoreId.set(
      s.storeId,
      (stampCountByStoreId.get(s.storeId) ?? 0) + 1,
    );
  }
  const minExchangeByStoreId = new Map<string, number>();
  for (const m of exchangeableMenus) {
    if (m.exchangePoints == null) continue;
    const prev = minExchangeByStoreId.get(m.showroomId);
    if (prev == null || m.exchangePoints < prev) {
      minExchangeByStoreId.set(m.showroomId, m.exchangePoints);
    }
  }
  const userBalance = calculateAvailablePoints(activeLedger, now);
  const activeTimesalesByStoreId = new Map<
    string,
    Array<{
      id: string;
      title: string;
      discountDetail: string;
      validUntil: string;
    }>
  >();
  for (const coupon of timesaleCoupons) {
    if (!isActiveTimesaleCoupon(coupon, now)) continue;
    const list = activeTimesalesByStoreId.get(coupon.showroomId) ?? [];
    list.push({
      id: coupon.id,
      title: coupon.title,
      discountDetail: coupon.discountDetail,
      validUntil: coupon.validUntil,
    });
    activeTimesalesByStoreId.set(coupon.showroomId, list);
  }
  const stores = rawShowrooms.map((raw) => {
    const showroom = toDomain(raw);
    const activeNotice = getActiveStatusNotice(showroom.statusNotice, now);
    return {
      id: showroom.id,
      userId: showroom.userId,
      storeName: showroom.storeName,
      location: showroom.location,
      avatarUrl: showroom.avatarUrl,
      ...(activeNotice ? { statusNotice: activeNotice } : {}),
      ...(showroom.tasteProfile ? { tasteProfile: showroom.tasteProfile } : {}),
      favorited: favoritedStoreIds.has(showroom.id),
      stampCount: stampCountByStoreId.get(showroom.id) ?? 0,
      canRedeem:
        canStoreRunPassport(showroom) &&
        (stampCountByStoreId.get(showroom.id) ?? 0) > 0 &&
        minExchangeByStoreId.has(showroom.id) &&
        userBalance >= (minExchangeByStoreId.get(showroom.id) ?? Infinity),
      hasActiveBeans:
        canStoreRunPassport(showroom) && activeBeanStoreIds.has(showroom.id),
      businessVerified: canStoreRunPassport(showroom),
      activeTimesaleCoupons: activeTimesalesByStoreId.get(showroom.id) ?? [],
    };
  });
  const favoritedIds = new Set(favorites.map((favorite) => favorite.id));
  const portfoliosByOwnerId = portfolios.reduce((groups, portfolio) => {
    if (!portfolio.ownerId) return groups;
    groups.set(portfolio.ownerId, [
      ...(groups.get(portfolio.ownerId) ?? []),
      toDomain(portfolio),
    ]);
    return groups;
  }, new Map<string, PortfolioItem[]>());

  return Response.json(
    {
      profiles: users.flatMap((user) =>
        userToMapProfiles({
          user,
          profile: profileByOwnerId.get(user.id),
          favorited: favoritedIds.has(user.id),
          isOwnProfile: currentUser?.id === user.id,
          canMessage:
            Boolean(currentUser) &&
            currentUser?.id !== user.id &&
            canSendMapMessage(currentUser),
          portfolios: portfoliosByOwnerId.get(user.id) ?? [],
        }),
      ),
      stores,
      viewerPassport: viewerProfile?.passport ?? null,
    } satisfies MapProfileResponse,
    { headers: { "Cache-Control": "no-store" } },
  );
}

function userToMapProfiles({
  user,
  profile,
  favorited,
  isOwnProfile,
  canMessage,
  portfolios,
}: {
  user: UserDocument;
  profile?: MemberProfile;
  favorited: boolean;
  isOwnProfile: boolean;
  canMessage: boolean;
  portfolios: PortfolioItem[];
}) {
  const locations = user.workplaceLocations ?? [];
  const publicPortfolios = profile?.isPortfolioPublic ? portfolios : [];

  return locations.filter(hasCoordinates).map((location, index) => ({
    id: index === 0 ? user.id : `${user.id}-${location.id}`,
    profileId: user.id,
    name: profile?.name ?? user.name,
    workplace: location.name,
    address: location.address,
    avatarUrl: profile?.avatarUrl ?? user.avatarUrl,
    online: profile?.online ?? true,
    role: profile?.role ?? user.role,
    handle: profile?.handle ?? user.handle ?? user.id,
    bio: profile?.bio ?? "",
    favoriteCount: profile?.favoriteCount ?? 0,
    favorited,
    isOwnProfile,
    canMessage,
    isPortfolioPublic: profile?.isPortfolioPublic ?? false,
    portfolios: publicPortfolios,
    skills: profile?.specialties.length
      ? profile.specialties
      : user.specialties,
    lat: location.lat,
    lng: location.lng,
  }));
}

function hasCoordinates(location: WorkplaceLocation) {
  return (
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng) &&
    !(location.lat === 0 && location.lng === 0)
  );
}
