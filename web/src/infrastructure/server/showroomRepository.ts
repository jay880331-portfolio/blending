import type { Filter } from "mongodb";
import { getMongoDb, toDomain } from "@/infrastructure/mongodb/client";
import { createId, nowIso } from "@/infrastructure/server/content";
import type {
  BaristaShowroom,
  CouponUsageScope,
  JoinedShowroomOption,
  NoticeManageStore,
  ShowroomCoupon,
  ShowroomMenu,
  StoreFavoriteItem,
  UserCoupon,
} from "@/domain/showroom/types";
import { ConflictError } from "@/infrastructure/server/timesalePush";
import { canStoreRunPassport } from "@/domain/passport/ledger";
import { canWriteShowroom } from "@/domain/showroom/access";
import {
  computeStatusNoticeExpiresAt,
  getActiveStatusNotice,
  hasActiveStatusNotice,
  validateStatusNoticeText,
  type ShowroomNoticeExpiryOption,
  type ShowroomStatusNotice,
  type StoredShowroomStatusNotice,
} from "@/domain/showroom/statusNotice";
import { isActiveTimesaleCoupon } from "@/domain/showroom/timesaleActive";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { authorizeStoreOwnerOrStaff } from "@/infrastructure/server/storeAuthorization";
import { claimCouponCampaign } from "./couponCampaignRepository";
import {
  decideCouponApproval,
  decideCouponReject,
  decideCouponUseRequest,
  decideRedemptionShowroom,
  isLiveOwnerCouponRequest,
  normalizeCouponUsageScope,
  resolveUserCouponStatus,
} from "@/domain/showroom/couponStatus";

export class NotFoundError extends Error {
  statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

// ----------------------------------------------------
// Showroom Operations
// ----------------------------------------------------

export function sanitizeShowroom(
  raw: BaristaShowroom,
  now = new Date(),
  options: { includeBusinessNumber?: boolean } = {},
): BaristaShowroom {
  const showroom = toDomain(raw);
  const businessVerified = canStoreRunPassport(showroom);
  const activeNotice = getActiveStatusNotice(showroom.statusNotice, now);
  const next: BaristaShowroom = {
    ...showroom,
    businessVerified,
  };
  if (!options.includeBusinessNumber) {
    delete next.businessVerification;
  }
  if (activeNotice) {
    next.statusNotice = activeNotice;
  } else {
    delete next.statusNotice;
  }
  return next;
}

export async function getShowrooms(
  sort: "latest" | "popular" = "latest",
): Promise<BaristaShowroom[]> {
  const db = await getMongoDb();
  const rawList = await db
    .collection<BaristaShowroom>("barista_showrooms")
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  const now = new Date();
  const domainList = rawList.map((raw) => sanitizeShowroom(raw, now));

  if (sort === "popular") {
    // 단골(즐겨찾기) 수에 따른 정렬
    const baristaIds = domainList.map((s) => s.userId);
    const favorites = await db
      .collection<{ id: string; deletedAt?: string }>("member_favorites")
      .find({ id: { $in: baristaIds }, deletedAt: { $exists: false } })
      .toArray();

    const counts = new Map<string, number>();
    for (const fav of favorites) {
      counts.set(fav.id, (counts.get(fav.id) ?? 0) + 1);
    }

    return domainList.sort((a, b) => {
      const countA = counts.get(a.userId) ?? 0;
      const countB = counts.get(b.userId) ?? 0;
      return countB - countA;
    });
  }

  return domainList;
}

export async function getShowroomById(
  id: string,
): Promise<BaristaShowroom | null> {
  const db = await getMongoDb();
  const raw = await db
    .collection<BaristaShowroom>("barista_showrooms")
    .findOne({ id });
  if (!raw) return null;
  return sanitizeShowroom(raw);
}

export async function getShowroomByUserId(
  userId: string,
  options: { includeBusinessNumber?: boolean } = {},
): Promise<BaristaShowroom | null> {
  const db = await getMongoDb();
  const raw = await db
    .collection<BaristaShowroom>("barista_showrooms")
    .findOne({ userId });
  if (!raw) return null;
  return sanitizeShowroom(raw, new Date(), options);
}

export async function upsertShowroom({
  userId,
  storeName,
  bioMessage,
  baristaName,
  avatarUrl,
  location,
  tasteProfile,
}: {
  userId: string;
  storeName: string;
  bioMessage: string;
  baristaName?: string;
  avatarUrl?: string;
  location?: { latitude: number; longitude: number; address?: string };
  tasteProfile?: BaristaShowroom["tasteProfile"];
}): Promise<BaristaShowroom> {
  const db = await getMongoDb();
  const existing = await db
    .collection<BaristaShowroom>("barista_showrooms")
    .findOne({ userId });

  const now = nowIso();

  if (existing) {
    const updated: Partial<BaristaShowroom> = {
      storeName: storeName.trim(),
      bioMessage: bioMessage.trim(),
      baristaName: baristaName?.trim() || existing.baristaName,
      avatarUrl: avatarUrl || existing.avatarUrl,
      location: location ?? existing.location,
      ...(tasteProfile !== undefined ? { tasteProfile } : {}),
      updatedAt: now,
    };
    await db
      .collection<BaristaShowroom>("barista_showrooms")
      .updateOne({ userId }, { $set: updated });

    return sanitizeShowroom({
      ...existing,
      ...updated,
    });
  }

  const newShowroom: BaristaShowroom = {
    id: createId("showroom"),
    userId,
    storeName: storeName.trim(),
    bioMessage: bioMessage.trim(),
    baristaName: baristaName?.trim(),
    avatarUrl,
    location,
    ...(tasteProfile !== undefined ? { tasteProfile } : {}),
    createdAt: now,
    updatedAt: now,
  };

  await db
    .collection<BaristaShowroom>("barista_showrooms")
    .insertOne(newShowroom);
  return toDomain(newShowroom);
}

// ----------------------------------------------------
// Menu Operations
// ----------------------------------------------------

export async function getMenusByShowroomId(
  showroomId: string,
): Promise<ShowroomMenu[]> {
  const db = await getMongoDb();
  const list = await db
    .collection<ShowroomMenu>("menus")
    .find({ showroomId })
    .sort({ createdAt: 1 })
    .toArray();
  return list.map(toDomain);
}

export async function createMenu({
  baristaId,
  showroomId,
  name,
  price,
  tastingNotes,
  imageUrl,
  exchangePoints = null,
}: {
  baristaId: string;
  showroomId: string;
  name: string;
  price: number;
  tastingNotes: string[];
  imageUrl: string;
  exchangePoints?: number | null;
}): Promise<ShowroomMenu> {
  const db = await getMongoDb();
  const now = nowIso();
  const menu: ShowroomMenu = {
    id: createId("menu"),
    baristaId,
    showroomId,
    name: name.trim(),
    price: Math.max(0, Math.floor(price)),
    tastingNotes: tastingNotes.map((s) => s.trim()).filter(Boolean),
    imageUrl: imageUrl.trim(),
    exchangePoints,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection<ShowroomMenu>("menus").insertOne(menu);
  return toDomain(menu);
}

export async function updateMenuExchangePoints(
  baristaId: string,
  menuId: string,
  exchangePoints: number | null,
): Promise<ShowroomMenu | null> {
  const db = await getMongoDb();
  const updated = await db
    .collection<ShowroomMenu>("menus")
    .findOneAndUpdate(
      { id: menuId, baristaId },
      { $set: { exchangePoints, updatedAt: nowIso() } },
      { returnDocument: "after" },
    );
  return updated ? toDomain(updated) : null;
}

export async function deleteMenu(
  baristaId: string,
  menuId: string,
): Promise<boolean> {
  const db = await getMongoDb();
  const result = await db
    .collection<ShowroomMenu>("menus")
    .deleteOne({ id: menuId, baristaId });
  return result.deletedCount > 0;
}

// ----------------------------------------------------
// Coupon Operations
// ----------------------------------------------------

export async function getCouponsByShowroomId(
  showroomId: string,
): Promise<ShowroomCoupon[]> {
  const db = await getMongoDb();
  const list = await db
    .collection<ShowroomCoupon>("coupons")
    .find({ showroomId })
    .sort({ createdAt: -1 })
    .toArray();
  return list.map(toDomain);
}

export async function getCouponById(
  id: string,
): Promise<ShowroomCoupon | null> {
  const db = await getMongoDb();
  const coupon = await db.collection<ShowroomCoupon>("coupons").findOne({ id });
  if (!coupon) return null;
  return toDomain(coupon);
}

export async function createCoupon({
  baristaId,
  showroomId,
  title,
  discountDetail,
  validUntil,
  couponType,
  usageScope = "own",
  designatedShowroomId,
  storeId,
  allowedStoreIds,
}: {
  baristaId: string;
  showroomId: string;
  title: string;
  discountDetail: string;
  validUntil: string;
  couponType: "regular" | "timesale";
  usageScope?: CouponUsageScope;
  designatedShowroomId?: string;
  storeId?: string;
  allowedStoreIds?: string[];
}): Promise<ShowroomCoupon> {
  const db = await getMongoDb();
  const now = nowIso();
  const coupon: ShowroomCoupon = {
    id: createId("coupon"),
    baristaId,
    showroomId,
    title: title.trim(),
    discountDetail: discountDetail.trim(),
    validUntil,
    couponType,
    usageScope,
    ...(usageScope === "SINGLE" ? { storeId: storeId || showroomId } : {}),
    ...(usageScope === "GROUP"
      ? { allowedStoreIds: [...new Set(allowedStoreIds)] }
      : {}),
    ...(usageScope === "designated" && designatedShowroomId
      ? { designatedShowroomId }
      : {}),
    createdAt: now,
    updatedAt: now,
  };

  await db.collection<ShowroomCoupon>("coupons").insertOne(coupon);
  return toDomain(coupon);
}

export async function deleteCoupon(
  baristaId: string,
  couponId: string,
): Promise<boolean> {
  const db = await getMongoDb();
  const result = await db
    .collection<ShowroomCoupon>("coupons")
    .updateOne(
      { id: couponId, baristaId },
      { $set: { issuanceStoppedAt: nowIso(), updatedAt: nowIso() } },
    );
  return result.matchedCount > 0;
}

// ----------------------------------------------------
// User Coupon (쿠폰함 & 사용) Operations
// ----------------------------------------------------

export async function claimCoupon(
  userId: string,
  couponId: string,
  requestId?: string,
): Promise<UserCoupon> {
  const db = await getMongoDb();

  // 대상 쿠폰 확인
  const coupon = await db
    .collection<ShowroomCoupon>("coupons")
    .findOne({ id: couponId });
  if (!coupon) {
    throw new NotFoundError("쿠폰을 찾을 수 없습니다.");
  }
  if (coupon.policyVersion === 2)
    return claimCouponCampaign(userId, couponId, requestId);
  if (coupon.issuanceStoppedAt)
    throw new ConflictError("추가 발급이 중단된 쿠폰입니다.");

  // 만료 여부 확인
  if (new Date(coupon.validUntil).getTime() < Date.now()) {
    throw new Error("이미 만료된 쿠폰입니다.");
  }

  // 멱등성: 이미 담았으면 기존 항목 반환
  const existing = await db
    .collection<UserCoupon>("user_coupons")
    .findOne({ userId, couponId });
  if (existing) {
    return toDomain(existing);
  }

  const now = nowIso();
  const userCoupon: UserCoupon = {
    id: createId("ucoupon"),
    userId,
    couponId,
    status: "ISSUED",
    usedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection<UserCoupon>("user_coupons").insertOne(userCoupon);
  return toDomain(userCoupon);
}

function usedCouponIfAlreadyUsed(userCoupon: UserCoupon): UserCoupon | null {
  if (userCoupon.status === "USED") {
    return toDomain(userCoupon);
  }
  return null;
}

export async function listJoinedShowrooms(
  userId: string,
): Promise<JoinedShowroomOption[]> {
  const db = await getMongoDb();
  const favorites = await db
    .collection<{ id: string }>("member_favorites")
    .find({ ownerId: userId, deletedAt: { $exists: false } })
    .project<{ id: string }>({ id: 1 })
    .toArray();
  const baristaIds = favorites.map((favorite) => favorite.id).filter(Boolean);
  if (baristaIds.length === 0) return [];

  const showrooms = await db
    .collection<BaristaShowroom>("barista_showrooms")
    .find({ userId: { $in: baristaIds } })
    .toArray();
  return showrooms.map((showroom) => ({
    id: showroom.id,
    storeName: showroom.storeName,
  }));
}

export async function openCouponUseRequest(
  userId: string,
  userCouponId: string,
  requestedShowroomId?: string | null,
): Promise<{
  userCoupon: UserCoupon;
  openedRequest: boolean;
  ownerUserId: string | null;
  couponTitle: string | null;
}> {
  const db = await getMongoDb();
  const rawUserCoupon = await db
    .collection<UserCoupon>("user_coupons")
    .findOne({ id: userCouponId, userId });

  if (!rawUserCoupon) {
    throw new NotFoundError("보유한 쿠폰을 찾을 수 없습니다.");
  }

  const alreadyUsed = usedCouponIfAlreadyUsed(rawUserCoupon);
  if (alreadyUsed) {
    return {
      userCoupon: alreadyUsed,
      openedRequest: false,
      ownerUserId: null,
      couponTitle: null,
    };
  }

  const coupon = await db
    .collection<ShowroomCoupon>("coupons")
    .findOne({ id: rawUserCoupon.couponId });
  const validUntil = coupon?.validUntil;
  if (["SINGLE", "GROUP", "ALL"].includes(coupon?.usageScope ?? "")) {
    throw new ConflictError("매장 QR을 스캔해 사용해 주세요.");
  }

  const now = new Date();
  const decision = decideCouponUseRequest(
    rawUserCoupon.status,
    validUntil,
    rawUserCoupon.approvalExpiresAt,
    now,
  );

  if (decision.kind === "used") {
    return {
      userCoupon: toDomain(rawUserCoupon),
      openedRequest: false,
      ownerUserId: null,
      couponTitle: null,
    };
  }

  if (decision.kind === "reject") {
    throw new Error("사용 기한이 지난 쿠폰입니다.");
  }

  if (decision.kind === "same") {
    return {
      userCoupon: toDomain(rawUserCoupon),
      openedRequest: false,
      ownerUserId: null,
      couponTitle: null,
    };
  }

  const scope = normalizeCouponUsageScope(coupon?.usageScope);
  const joinedShowroomIds =
    scope === "joined"
      ? (await listJoinedShowrooms(userId)).map((showroom) => showroom.id)
      : [];
  const place = decideRedemptionShowroom({
    usageScope: coupon?.usageScope,
    issuerShowroomId: coupon?.showroomId ?? "",
    designatedShowroomId: coupon?.designatedShowroomId,
    requestedShowroomId,
    joinedShowroomIds,
    storeId: coupon?.storeId,
    allowedStoreIds: coupon?.allowedStoreIds,
  });
  if (!place.ok) {
    throw new Error(
      scope === "joined"
        ? "가입한 카페에서만 사용할 수 있습니다."
        : "사용할 카페를 찾을 수 없습니다.",
    );
  }

  const nowIsoStr = now.toISOString();
  const orConditions: Filter<UserCoupon>[] = [
    { status: "ISSUED" },
    { status: "REQUESTED", approvalExpiresAt: null },
    { status: "REQUESTED", approvalExpiresAt: "" },
    { status: "REQUESTED", approvalExpiresAt: { $lte: nowIsoStr } },
  ];
  if (
    rawUserCoupon.approvalExpiresAt &&
    Number.isNaN(new Date(rawUserCoupon.approvalExpiresAt).getTime())
  ) {
    orConditions.push({
      status: "REQUESTED",
      approvalExpiresAt: rawUserCoupon.approvalExpiresAt,
    });
  }

  const updated = await db
    .collection<UserCoupon>("user_coupons")
    .findOneAndUpdate(
      {
        id: userCouponId,
        userId,
        $or: orConditions,
      },
      {
        $set: {
          status: "REQUESTED",
          approvalExpiresAt: decision.approvalExpiresAt,
          redemptionShowroomId: place.showroomId,
          updatedAt: nowIsoStr,
        },
      },
      { returnDocument: "after" },
    );

  if (updated) {
    const showroom = await db
      .collection<BaristaShowroom>("barista_showrooms")
      .findOne({ id: place.showroomId });
    const ownerUserId = showroom?.userId ?? null;
    const couponTitle = coupon?.title ?? null;

    return {
      userCoupon: toDomain(updated),
      openedRequest: true,
      ownerUserId,
      couponTitle,
    };
  }

  const reloaded = await db
    .collection<UserCoupon>("user_coupons")
    .findOne({ id: userCouponId, userId });

  if (!reloaded) {
    throw new NotFoundError("보유한 쿠폰을 찾을 수 없습니다.");
  }

  if (reloaded.status === "USED") {
    return {
      userCoupon: toDomain(reloaded),
      openedRequest: false,
      ownerUserId: null,
      couponTitle: null,
    };
  }

  const reloadedDecision = decideCouponUseRequest(
    reloaded.status,
    validUntil,
    reloaded.approvalExpiresAt,
    new Date(),
  );

  if (reloadedDecision.kind === "same" || reloadedDecision.kind === "used") {
    return {
      userCoupon: toDomain(reloaded),
      openedRequest: false,
      ownerUserId: null,
      couponTitle: null,
    };
  }

  if (reloadedDecision.kind === "reject") {
    throw new Error("사용 기한이 지난 쿠폰입니다.");
  }

  throw new Error("쿠폰 사용 요청을 저장하지 못했습니다.");
}

export async function redeemUserCoupon(
  userId: string,
  userCouponId: string,
  requestedShowroomId?: string | null,
): Promise<UserCoupon> {
  return (await openCouponUseRequest(userId, userCouponId, requestedShowroomId))
    .userCoupon;
}

export const useCoupon = redeemUserCoupon;

export async function getUserCoupons(userId: string): Promise<UserCoupon[]> {
  const db = await getMongoDb();
  const rawList = await db
    .collection<UserCoupon>("user_coupons")
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();

  if (rawList.length === 0) return [];

  const couponIds = rawList.map((uc) => uc.couponId);
  const coupons = await db
    .collection<ShowroomCoupon>("coupons")
    .find({ id: { $in: couponIds } })
    .toArray();
  const couponMap = new Map<string, ShowroomCoupon>(
    coupons.map((c) => [c.id, toDomain(c)]),
  );

  const showroomIds = [
    ...coupons.map((c) => c.showroomId),
    ...rawList.flatMap((uc) =>
      uc.couponSnapshot ? [uc.couponSnapshot.showroomId] : [],
    ),
  ];
  const showrooms = await db
    .collection<BaristaShowroom>("barista_showrooms")
    .find({ id: { $in: showroomIds } })
    .toArray();
  const showroomMap = new Map<string, BaristaShowroom>(
    showrooms.map((s) => [s.id, toDomain(s)]),
  );

  return rawList.map((uc) => {
    const domainUc = toDomain(uc);
    const coupon = uc.couponSnapshot ?? couponMap.get(uc.couponId);
    if (coupon) {
      domainUc.coupon = coupon;
      domainUc.showroom = showroomMap.get(coupon.showroomId);
    }
    domainUc.status = resolveUserCouponStatus(
      uc.status,
      coupon?.validUntil,
      new Date(),
      domainUc.approvalExpiresAt,
    );
    return domainUc;
  });
}

async function loadOwnedCouponForDecision(
  sessionUserId: string,
  role: string | undefined,
  userCouponId: string,
) {
  const db = await getMongoDb();
  const userCoupon = await db
    .collection<UserCoupon>("user_coupons")
    .findOne({ id: userCouponId });
  if (!userCoupon) {
    throw new NotFoundError("보유한 쿠폰을 찾을 수 없습니다.");
  }
  const coupon = await db
    .collection<ShowroomCoupon>("coupons")
    .findOne({ id: userCoupon.couponId });
  if (!coupon) {
    throw new NotFoundError("보유한 쿠폰을 찾을 수 없습니다.");
  }
  const redemptionShowroomId =
    userCoupon.redemptionShowroomId || coupon.showroomId;
  const showroom = await db
    .collection<BaristaShowroom>("barista_showrooms")
    .findOne({ id: redemptionShowroomId });
  if (
    !showroom ||
    showroom.userId !== sessionUserId ||
    !canWriteShowroom(role)
  ) {
    throw new NotFoundError("보유한 쿠폰을 찾을 수 없습니다.");
  }
  return { db, userCoupon, coupon, showroom };
}

export async function approveOwnerCouponUse(
  sessionUserId: string,
  role: string | undefined,
  userCouponId: string,
): Promise<UserCoupon> {
  const { db, userCoupon, coupon } = await loadOwnedCouponForDecision(
    sessionUserId,
    role,
    userCouponId,
  );
  if (["SINGLE", "GROUP", "ALL"].includes(coupon.usageScope ?? "")) {
    throw new ConflictError("매장 QR을 스캔해 사용해 주세요.");
  }

  const decision = decideCouponApproval(
    userCoupon.status,
    coupon.validUntil,
    userCoupon.approvalExpiresAt,
    new Date(),
  );

  if (decision.kind === "already_used") {
    return toDomain(userCoupon);
  }

  if (decision.kind === "conflict") {
    throw new ConflictError("이미 처리되었거나 승인 시간이 지났습니다.");
  }

  const updated = await db
    .collection<UserCoupon>("user_coupons")
    .findOneAndUpdate(
      {
        id: userCouponId,
        status: "REQUESTED",
        approvalExpiresAt: userCoupon.approvalExpiresAt ?? null,
        redemptionShowroomId: userCoupon.redemptionShowroomId ?? null,
      },
      {
        $set: {
          status: "USED",
          usedAt: decision.usedAt,
          updatedAt: decision.usedAt,
        },
        $unset: {
          approvalExpiresAt: "",
        },
      },
      { returnDocument: "after" },
    );

  if (updated) {
    return toDomain(updated);
  }

  const reloaded = await db
    .collection<UserCoupon>("user_coupons")
    .findOne({ id: userCouponId });
  if (reloaded && reloaded.status === "USED") {
    return toDomain(reloaded);
  }

  throw new ConflictError("이미 처리되었거나 승인 시간이 지났습니다.");
}

export async function rejectOwnerCouponUse(
  sessionUserId: string,
  role: string | undefined,
  userCouponId: string,
): Promise<UserCoupon> {
  const { db, userCoupon, coupon } = await loadOwnedCouponForDecision(
    sessionUserId,
    role,
    userCouponId,
  );

  const decision = decideCouponReject(
    userCoupon.status,
    coupon.validUntil,
    userCoupon.approvalExpiresAt,
    new Date(),
  );

  if (decision.kind === "already_issued") {
    return toDomain(userCoupon);
  }

  if (decision.kind === "conflict") {
    throw new ConflictError("이미 처리되었거나 승인 시간이 지났습니다.");
  }

  const now = nowIso();
  const updated = await db
    .collection<UserCoupon>("user_coupons")
    .findOneAndUpdate(
      {
        id: userCouponId,
        status: "REQUESTED",
        approvalExpiresAt: userCoupon.approvalExpiresAt ?? null,
        redemptionShowroomId: userCoupon.redemptionShowroomId ?? null,
      },
      {
        $set: {
          status: "ISSUED",
          updatedAt: now,
        },
        $unset: {
          approvalExpiresAt: "",
          redemptionShowroomId: "",
        },
      },
      { returnDocument: "after" },
    );

  if (updated) {
    return toDomain(updated);
  }

  const reloaded = await db
    .collection<UserCoupon>("user_coupons")
    .findOne({ id: userCouponId });
  if (reloaded && reloaded.status === "ISSUED") {
    return toDomain(reloaded);
  }

  throw new ConflictError("이미 처리되었거나 승인 시간이 지났습니다.");
}

export type OwnerCouponRequestItem = {
  userCouponId: string;
  couponTitle: string;
  memberName: string;
};

export async function listOwnerCouponRequests(
  sessionUserId: string,
  role: string | undefined,
): Promise<{ requests: OwnerCouponRequestItem[] }> {
  if (!canWriteShowroom(role)) {
    throw new NotFoundError("보유한 쿠폰을 찾을 수 없습니다.");
  }

  const showroom = await getShowroomByUserId(sessionUserId);
  if (!showroom) {
    return { requests: [] };
  }

  const db = await getMongoDb();
  const myCoupons = await db
    .collection<ShowroomCoupon>("coupons")
    .find({ showroomId: showroom.id })
    .toArray();
  const myCouponIds = myCoupons.map((coupon) => coupon.id);
  const clauses: Record<string, unknown>[] = [
    { redemptionShowroomId: showroom.id },
  ];
  if (myCouponIds.length > 0) {
    clauses.push({
      redemptionShowroomId: null,
      couponId: { $in: myCouponIds },
    });
  }

  const rawUserCoupons = await db
    .collection<UserCoupon>("user_coupons")
    .find({ status: "REQUESTED", $or: clauses })
    .toArray();

  if (rawUserCoupons.length === 0) {
    return { requests: [] };
  }

  const relatedIds = Array.from(
    new Set(rawUserCoupons.map((userCoupon) => userCoupon.couponId)),
  );
  const relatedCoupons = await db
    .collection<ShowroomCoupon>("coupons")
    .find({ id: { $in: relatedIds } })
    .toArray();
  const couponMap = new Map<string, ShowroomCoupon>(
    relatedCoupons.map((coupon) => [coupon.id, coupon]),
  );

  const now = new Date();
  const liveUserCoupons = rawUserCoupons.filter((uc) => {
    const coupon = couponMap.get(uc.couponId);
    if (!coupon) return false;
    return isLiveOwnerCouponRequest(
      uc.status,
      coupon.validUntil,
      uc.approvalExpiresAt,
      now,
    );
  });

  if (liveUserCoupons.length === 0) {
    return { requests: [] };
  }

  const userIds = Array.from(new Set(liveUserCoupons.map((uc) => uc.userId)));
  const profiles = await db
    .collection<{ ownerId: string; name?: string }>("member_profiles")
    .find({ ownerId: { $in: userIds } })
    .project<{ ownerId: string; name?: string }>({ ownerId: 1, name: 1 })
    .toArray();

  const nameMap = new Map<string, string>(
    profiles.map((p) => [p.ownerId, p.name || ""]),
  );

  const requests: OwnerCouponRequestItem[] = liveUserCoupons.map((uc) => ({
    userCouponId: uc.id,
    couponTitle: couponMap.get(uc.couponId)?.title || "",
    memberName: nameMap.get(uc.userId) || "",
  }));

  return { requests };
}

// ----------------------------------------------------
// Member Location Operations
// ----------------------------------------------------

export async function upsertMemberLastLocation(
  userId: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  const db = await getMongoDb();
  await db.collection("member_last_locations").updateOne(
    { userId },
    {
      $set: {
        userId,
        location: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

// ----------------------------------------------------
// Store Status Notice Operations
// ----------------------------------------------------

type CouponStaffDoc = {
  storeId: string;
  userId: string;
  grantedBy: string;
  active: boolean;
};

export async function authorizeShowroomNoticeWriter(
  userId: string,
  storeId: string,
): Promise<BaristaShowroom> {
  const db = await getMongoDb();
  const auth = await authorizeStoreOwnerOrStaff({ userId, storeId, db });
  if (!auth.authorized) {
    if (auth.reason === "store_not_found") {
      throw new NotFoundError("쇼룸을 찾을 수 없습니다.");
    }
    throw new ForbiddenError("이 매장의 한줄공지를 수정할 권한이 없습니다.");
  }
  return sanitizeShowroom(auth.store);
}

export async function updateShowroomStatusNotice({
  userId,
  storeId,
  text,
  expiryOption,
}: {
  userId: string;
  storeId: string;
  text: string;
  expiryOption: ShowroomNoticeExpiryOption;
}): Promise<ShowroomStatusNotice> {
  const validated = validateStatusNoticeText(text);
  if (!validated.ok) {
    throw new Error(validated.error);
  }
  await authorizeShowroomNoticeWriter(userId, storeId);

  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = computeStatusNoticeExpiresAt(
    expiryOption,
    now,
  ).toISOString();
  const storedNotice: StoredShowroomStatusNotice = {
    text: validated.text,
    createdAt,
    expiresAt,
    updatedBy: userId,
  };

  const db = await getMongoDb();
  await db
    .collection<BaristaShowroom>("barista_showrooms")
    .updateOne(
      { id: storeId },
      { $set: { statusNotice: storedNotice, updatedAt: createdAt } },
    );

  return {
    text: storedNotice.text,
    createdAt: storedNotice.createdAt,
    expiresAt: storedNotice.expiresAt,
  };
}

export async function clearShowroomStatusNotice({
  userId,
  storeId,
}: {
  userId: string;
  storeId: string;
}): Promise<void> {
  await authorizeShowroomNoticeWriter(userId, storeId);
  const db = await getMongoDb();
  await db
    .collection<BaristaShowroom>("barista_showrooms")
    .updateOne(
      { id: storeId },
      { $unset: { statusNotice: "" }, $set: { updatedAt: nowIso() } },
    );
}

export async function listNoticeManageStores(
  userId: string,
): Promise<NoticeManageStore[]> {
  const db = await getMongoDb();
  const grants = await db
    .collection<CouponStaffDoc>("coupon_store_staff")
    .find({ userId, active: true })
    .toArray();
  const staffStoreIds = grants.map((g) => g.storeId);
  const rawStores = await db
    .collection<BaristaShowroom>("barista_showrooms")
    .find({
      $or: [{ userId }, { id: { $in: staffStoreIds } }],
    })
    .toArray();

  const now = new Date();
  const result: NoticeManageStore[] = [];
  for (const raw of rawStores) {
    try {
      const store = await authorizeShowroomNoticeWriter(userId, raw.id);
      const activeNotice = getActiveStatusNotice(store.statusNotice, now);
      result.push({
        id: store.id,
        storeName: store.storeName,
        isOwner: store.userId === userId,
        ...(activeNotice ? { statusNotice: activeNotice } : {}),
      });
    } catch (error) {
      if (
        !(error instanceof ForbiddenError) &&
        !(error instanceof NotFoundError)
      )
        throw error;
    }
  }
  return result;
}

// ----------------------------------------------------
// Store Favorites Operations
// ----------------------------------------------------

type StoreFavoriteDoc = {
  ownerId: string;
  storeId: string;
  createdAt: string;
};

export async function setStoreFavorite(
  ownerId: string,
  storeId: string,
): Promise<void> {
  await ensureMongoIndexes();
  const db = await getMongoDb();
  const store = await db
    .collection<BaristaShowroom>("barista_showrooms")
    .findOne({ id: storeId }, { projection: { id: 1 } });
  if (!store) {
    throw new NotFoundError("쇼룸을 찾을 수 없습니다.");
  }

  await db.collection<StoreFavoriteDoc>("store_favorites").updateOne(
    { ownerId, storeId },
    {
      $setOnInsert: {
        ownerId,
        storeId,
        createdAt: nowIso(),
      },
    },
    { upsert: true },
  );
}

export async function removeStoreFavorite(
  ownerId: string,
  storeId: string,
): Promise<void> {
  await ensureMongoIndexes();
  const db = await getMongoDb();
  await db
    .collection<StoreFavoriteDoc>("store_favorites")
    .deleteOne({ ownerId, storeId });
}

export async function isStoreFavorited(
  ownerId: string,
  storeId: string,
): Promise<boolean> {
  const db = await getMongoDb();
  const existing = await db
    .collection<StoreFavoriteDoc>("store_favorites")
    .findOne({ ownerId, storeId }, { projection: { _id: 1 } });
  return Boolean(existing);
}

export async function listStoreFavorites(
  ownerId: string,
): Promise<StoreFavoriteItem[]> {
  await ensureMongoIndexes();
  const db = await getMongoDb();
  const rows = await db
    .collection<StoreFavoriteDoc>("store_favorites")
    .find({ ownerId })
    .sort({ createdAt: -1 })
    .toArray();

  if (rows.length === 0) return [];

  const storeIds = rows.map((row) => row.storeId);
  const now = new Date();
  const nowIsoStr = now.toISOString();
  const [rawStores, timesaleCoupons] = await Promise.all([
    db
      .collection<BaristaShowroom>("barista_showrooms")
      .find({ id: { $in: storeIds } })
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
  ]);

  const storeMap = new Map(
    rawStores.map((raw) => [raw.id, sanitizeShowroom(raw, now)]),
  );
  const activeTimesaleStoreIds = new Set(
    timesaleCoupons
      .filter((coupon) => isActiveTimesaleCoupon(coupon, now))
      .map((coupon) => coupon.showroomId),
  );

  const items: StoreFavoriteItem[] = [];
  for (const row of rows) {
    const store = storeMap.get(row.storeId);
    if (!store) continue;
    items.push({
      storeId: store.id,
      storeName: store.storeName,
      address: store.location?.address,
      avatarUrl: store.avatarUrl,
      baristaName: store.baristaName,
      hasActiveNotice: hasActiveStatusNotice(store.statusNotice, now),
      hasActiveTimesale: activeTimesaleStoreIds.has(store.id),
      createdAt: row.createdAt,
    });
  }
  return items;
}
