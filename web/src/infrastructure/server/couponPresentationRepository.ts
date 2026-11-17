import { createHash, randomBytes } from "node:crypto";
import type { Db, MongoClient, ClientSession } from "mongodb";
import {
  getMongoDb,
  getMongoClient,
  toDomain,
} from "@/infrastructure/mongodb/client";
import type {
  BaristaShowroom,
  ShowroomCoupon,
  UserCoupon,
} from "@/domain/showroom/types";
import { canWriteShowroom } from "@/domain/showroom/access";
import {
  CouponRedemptionError,
  redeemCouponAtStore,
} from "./couponRedemptionRepository";
import { authorizeStoreOwnerOrStaff } from "./storeAuthorization";

import { couponAllowsStore } from "@/domain/showroom/storeQr";
import { listJoinedShowrooms } from "./showroomRepository";

type Resources = { db: Db; client: MongoClient };
type Presentation = {
  _id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  purgeAt: Date;
  state: "OPEN" | "USED" | "CANCELLED";
  storeId?: string;
  processedBy?: string;
};
type Staff = {
  _id: string;
  storeId: string;
  userId: string;
  grantedBy: string;
  active: boolean;
  updatedAt: string;
};
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const presentations = (db: Db) =>
  db.collection<Presentation>("coupon_presentations");

export async function authorizedCouponStore(
  userId: string,
  storeId: string,
  db: Db,
  session?: ClientSession,
) {
  const auth = await authorizeStoreOwnerOrStaff({
    userId,
    storeId,
    db,
    session,
  });
  if (!auth.authorized) {
    throw new CouponRedemptionError(
      "이 매장의 쿠폰을 처리할 권한이 없습니다.",
      403,
    );
  }
  if (session && auth.staff && !auth.isOwner)
    await db
      .collection<Staff>("coupon_store_staff")
      .updateOne(
        { _id: auth.staff._id, active: true, grantedBy: auth.store.userId },
        { $set: { updatedAt: new Date().toISOString() } },
        { session },
      );
  return auth.store;
}

export async function listCouponStaffStores(userId: string, database?: Db) {
  const db = database ?? (await getMongoDb());
  const grants = await db
    .collection<Staff>("coupon_store_staff")
    .find({ userId, active: true })
    .toArray();
  const stores = await db
    .collection<BaristaShowroom>("barista_showrooms")
    .find({ $or: [{ userId }, { id: { $in: grants.map((g) => g.storeId) } }] })
    .toArray();
  const result: { id: string; storeName: string }[] = [];
  for (const store of stores) {
    try {
      await authorizedCouponStore(userId, store.id, db);
      result.push({ id: store.id, storeName: store.storeName });
    } catch (error) {
      if (!(error instanceof CouponRedemptionError)) throw error;
    }
  }
  return result;
}

function validateWallet(wallet: UserCoupon, coupon: ShowroomCoupon) {
  const now = Date.now();
  if (
    !["ISSUED", "REQUESTED"].includes(wallet.status) ||
    !Number.isFinite(Date.parse(coupon.validUntil)) ||
    Date.parse(coupon.validUntil) <= now ||
    (coupon.validFrom && Date.parse(coupon.validFrom) > now) ||
    (coupon.policyVersion === 2 && coupon.approvalState !== "ACTIVE")
  )
    throw new CouponRedemptionError("지금 사용할 수 없는 쿠폰입니다.", 409);
}

export async function createCouponPresentation(
  userId: string,
  userCouponId: string,
  resources?: Resources,
) {
  const db = resources?.db ?? (await getMongoDb()),
    client = resources?.client ?? (await getMongoClient());
  await presentations(db).createIndex({ tokenHash: 1 }, { unique: true });
  await presentations(db).createIndex(
    { purgeAt: 1 },
    { expireAfterSeconds: 0 },
  );
  const session = client.startSession();
  try {
    return await session.withTransaction(
      async () => {
        const wallet = await db
          .collection<UserCoupon>("user_coupons")
          .findOne({ id: userCouponId, userId }, { session });
        const coupon =
          wallet?.couponSnapshot ??
          (wallet &&
            (await db
              .collection<ShowroomCoupon>("coupons")
              .findOne({ id: wallet.couponId }, { session })));
        if (!wallet || !coupon)
          throw new CouponRedemptionError(
            "보유한 쿠폰을 찾을 수 없습니다.",
            404,
          );
        validateWallet(wallet, coupon);
        const now = Date.now(),
          token = randomBytes(32).toString("base64url"),
          expiresAt = new Date(now + 60000);
        await presentations(db).replaceOne(
          { _id: userCouponId },
          {
            userId,
            tokenHash: hash(token),
            expiresAt,
            purgeAt: new Date(now + 86400000),
            state: "OPEN",
          },
          { upsert: true, session },
        );
        return { token, expiresAt: expiresAt.toISOString() };
      },
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
    );
  } finally {
    await session.endSession();
  }
}

export async function cancelCouponPresentation(
  userId: string,
  userCouponId: string,
  token: string,
  database?: Db,
) {
  const db = database ?? (await getMongoDb());
  await presentations(db).updateOne(
    { _id: userCouponId, userId, tokenHash: hash(token), state: "OPEN" },
    { $set: { state: "CANCELLED" } },
  );
}

export async function readCouponPresentation(
  userId: string,
  userCouponId: string,
  database?: Db,
) {
  const db = database ?? (await getMongoDb());
  const wallet = await db
    .collection<UserCoupon>("user_coupons")
    .findOne({ id: userCouponId, userId });
  if (!wallet)
    throw new CouponRedemptionError("보유한 쿠폰을 찾을 수 없습니다.", 404);
  return { userCoupon: toDomain(wallet) };
}

export async function inspectPresentedCoupon(
  staffId: string,
  storeId: string,
  token: string,
  resources?: Resources,
  session?: ClientSession,
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new CouponRedemptionError("고객의 블렌딩 쿠폰 QR을 스캔해 주세요.");
  const db = resources?.db ?? (await getMongoDb());
  const store = await authorizedCouponStore(staffId, storeId, db, session);
  const presentation = await presentations(db).findOne(
    { tokenHash: hash(token) },
    { session },
  );
  if (
    !presentation ||
    presentation.state === "CANCELLED" ||
    (presentation.state === "OPEN" &&
      presentation.expiresAt.getTime() <= Date.now())
  )
    throw new CouponRedemptionError(
      "만료되거나 새로 발급된 QR입니다. 고객에게 새 QR을 요청해 주세요.",
      409,
    );
  if (presentation.userId === staffId)
    throw new CouponRedemptionError(
      "본인의 쿠폰은 다른 직원에게 보여주세요.",
      403,
    );
  if (
    presentation.state === "USED" &&
    (presentation.storeId !== storeId || presentation.processedBy !== staffId)
  )
    throw new CouponRedemptionError("이미 처리된 QR입니다.", 409);
  const wallet = await db
    .collection<UserCoupon>("user_coupons")
    .findOne(
      { id: presentation._id, userId: presentation.userId },
      { session },
    );
  const coupon =
    wallet?.couponSnapshot ??
    (wallet &&
      (await db
        .collection<ShowroomCoupon>("coupons")
        .findOne({ id: wallet.couponId }, { session })));
  if (!wallet || !coupon)
    throw new CouponRedemptionError("쿠폰을 찾을 수 없습니다.", 404);
  if (presentation.state !== "USED") {
    validateWallet(wallet, coupon);
    const joined =
      coupon.usageScope === "joined"
        ? (await listJoinedShowrooms(wallet.userId)).map((item) => item.id)
        : [];
    if (
      !couponAllowsStore(
        coupon,
        store.id,
        joined,
        Boolean(store.platformCouponsAcceptedAt),
      )
    )
      throw new CouponRedemptionError(
        `현재 매장(${store.storeName})에서는 사용할 수 없는 쿠폰입니다.`,
        403,
      );
  }
  return { store, presentation, wallet, coupon };
}

export async function redeemPresentedCoupon(
  staffId: string,
  storeId: string,
  token: string,
  resources?: Resources,
) {
  const db = resources?.db ?? (await getMongoDb()),
    client = resources?.client ?? (await getMongoClient());
  const session = client.startSession();
  try {
    return await session.withTransaction(
      async () => {
        const { store, presentation, wallet, coupon } =
          await inspectPresentedCoupon(
            staffId,
            storeId,
            token,
            { db, client },
            session,
          );
        const result = await redeemCouponAtStore(
          wallet.userId,
          wallet.id,
          null,
          {
            db,
            client,
            session,
            processedBy: staffId,
            store: {
              id: store.id,
              storeName: store.storeName,
              acceptsPlatformCoupons: Boolean(store.platformCouponsAcceptedAt),
            },
          },
        );
        if (presentation.state !== "USED") {
          const consumed = await presentations(db).updateOne(
            {
              _id: presentation._id,
              tokenHash: hash(token),
              state: "OPEN",
              expiresAt: { $gt: new Date() },
            },
            { $set: { state: "USED", storeId, processedBy: staffId } },
            { session },
          );
          if (consumed.modifiedCount !== 1)
            throw new CouponRedemptionError(
              "QR이 만료되었습니다. 고객에게 새 QR을 요청해 주세요.",
              409,
            );
        }
        return { ...result, coupon };
      },
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
    );
  } finally {
    await session.endSession();
  }
}

export async function listCouponStaff(ownerId: string, database?: Db) {
  const db = database ?? (await getMongoDb());
  const store = await db
    .collection<BaristaShowroom>("barista_showrooms")
    .findOne({ userId: ownerId });
  if (!store) return [];
  const grants = await db
    .collection<Staff>("coupon_store_staff")
    .find({ storeId: store.id, grantedBy: ownerId, active: true })
    .toArray();
  const users = await db
    .collection("users")
    .find({ id: { $in: grants.map((g) => g.userId) } })
    .project({ id: 1, name: 1 })
    .toArray();
  return users.map((user) => ({
    id: user.id as string,
    name: user.name as string,
  }));
}

export async function manageCouponStaff(
  ownerId: string,
  input: { phone?: string; userId?: string; revoke?: boolean },
  database?: Db,
) {
  const db = database ?? (await getMongoDb());
  const store = await db
    .collection<BaristaShowroom>("barista_showrooms")
    .findOne({ userId: ownerId });
  if (!store)
    throw new CouponRedemptionError(
      "쇼룸 관리자만 직원을 등록할 수 있습니다.",
      403,
    );
  await authorizedCouponStore(ownerId, store.id, db);
  if (input.revoke) {
    if (
      typeof input.userId !== "string" ||
      !input.userId ||
      input.userId.length > 100
    )
      throw new CouponRedemptionError("직원 정보를 확인해 주세요.");
    await db
      .collection<Staff>("coupon_store_staff")
      .updateOne(
        { storeId: store.id, userId: input.userId, grantedBy: ownerId },
        { $set: { active: false, updatedAt: new Date().toISOString() } },
      );
    return { success: true };
  }
  if (
    typeof input.phone !== "string" ||
    !/^01[0-9]{8,9}$/.test(input.phone.replace(/\D/g, ""))
  )
    throw new CouponRedemptionError("직원 휴대폰 번호를 확인해 주세요.");
  const target = await db
    .collection("users")
    .findOne({ phone: input.phone.replace(/\D/g, "") });
  if (
    !target ||
    !canWriteShowroom(target.role) ||
    (target.accountStatus && target.accountStatus !== "active") ||
    target.id === ownerId
  )
    throw new CouponRedemptionError(
      "등록 가능한 바리스타 계정을 확인해 주세요.",
    );
  await db.collection<Staff>("coupon_store_staff").updateOne(
    { _id: JSON.stringify([store.id, target.id]) },
    {
      $set: {
        storeId: store.id,
        userId: target.id,
        grantedBy: ownerId,
        active: true,
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true },
  );
  return { success: true };
}
