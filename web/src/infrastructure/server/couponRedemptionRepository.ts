import { randomBytes } from "node:crypto";
import type { ClientSession, Db, MongoClient } from "mongodb";
import {
  getMongoClient,
  getMongoDb,
  toDomain,
} from "@/infrastructure/mongodb/client";
import { canWriteShowroom } from "@/domain/showroom/access";
import { couponAllowsStore, isStoreQr } from "@/domain/showroom/storeQr";
import type {
  BaristaShowroom,
  CouponStore,
  CouponUsageLog,
  ShowroomCoupon,
  StoreQr,
  UserCoupon,
} from "@/domain/showroom/types";
import { listJoinedShowrooms } from "./showroomRepository";

type QrDocument = { _id: string; code: string };
export class CouponRedemptionError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export async function getStoreQr(storeId: string): Promise<StoreQr> {
  const db = await getMongoDb();
  const qr = await db
    .collection<QrDocument>("store_qr_codes")
    .findOneAndUpdate(
      { _id: storeId },
      { $setOnInsert: { code: randomBytes(32).toString("base64url") } },
      { upsert: true, returnDocument: "after" },
    );
  if (!qr) throw new Error("매장 QR을 생성하지 못했습니다.");
  return { storeId, code: qr.code };
}

export async function verifyStoreQr(
  qr: StoreQr,
  database?: Db,
  session?: ClientSession,
): Promise<CouponStore> {
  const db = database ?? (await getMongoDb());
  if (!isStoreQr(qr))
    throw new CouponRedemptionError("블렌딩 매장 QR을 스캔해 주세요.");
  const registered = await db
    .collection<QrDocument>("store_qr_codes")
    .findOne({ _id: qr.storeId, code: qr.code }, { session });
  const store =
    registered &&
    (await db
      .collection<BaristaShowroom>("barista_showrooms")
      .findOne({ id: qr.storeId }, { session }));
  const owner =
    store &&
    (await db.collection("users").findOne({ id: store.userId }, { session }));
  if (
    !store ||
    !owner ||
    !canWriteShowroom(owner.role) ||
    (owner.accountStatus && owner.accountStatus !== "active")
  ) {
    throw new CouponRedemptionError(
      "사용할 수 없는 매장 QR입니다. 매장에 확인해 주세요.",
      404,
    );
  }
  return {
    id: store.id,
    storeName: store.storeName,
    acceptsPlatformCoupons: Boolean(store.platformCouponsAcceptedAt),
  };
}

export async function redeemCouponAtStore(
  userId: string,
  userCouponId: string,
  qr: StoreQr | null,
  resources?: {
    db: Db;
    client: MongoClient;
    joinedStoreIds?: string[];
    session?: ClientSession;
    store?: CouponStore;
    processedBy?: string;
  },
): Promise<{ userCoupon: UserCoupon; store: CouponStore; newlyUsed: boolean }> {
  if (!resources?.store && !isStoreQr(qr))
    throw new CouponRedemptionError("매장 QR을 먼저 확인해 주세요.");
  const db = resources?.db ?? (await getMongoDb());
  const client = resources?.client ?? (await getMongoClient());
  // 이전 joined 쿠폰만 기존 회원 가입 관계를 유지한다.
  const oldCoupon = await db
    .collection<UserCoupon>("user_coupons")
    .findOne({ id: userCouponId, userId });
  if (!oldCoupon)
    throw new CouponRedemptionError("보유한 쿠폰을 찾을 수 없습니다.", 404);
  const definition = await db
    .collection<ShowroomCoupon>("coupons")
    .findOne({ id: oldCoupon.couponId });
  const joinedStoreIds =
    definition?.usageScope === "joined"
      ? (resources?.joinedStoreIds ??
        (await listJoinedShowrooms(userId)).map((store) => store.id))
      : [];
  const session = resources?.session ?? client.startSession();
  try {
    const execute = async () => {
      // 기기 QR의 유효성도 트랜잭션마다 재확인한다.
      const store = resources?.store ?? (await verifyStoreQr(qr!, db, session));
      const userCoupons = db.collection<UserCoupon>("user_coupons");
      const userCoupon = await userCoupons.findOne(
        { id: userCouponId, userId },
        { session },
      );
      if (!userCoupon)
        throw new CouponRedemptionError("보유한 쿠폰을 찾을 수 없습니다.", 404);
      if (userCoupon.status === "USED") {
        if (userCoupon.usedAtStoreId !== store.id)
          throw new CouponRedemptionError("이미 사용한 쿠폰입니다.", 409);
        return { userCoupon: toDomain(userCoupon), store, newlyUsed: false };
      }
      const currentCoupon = await db
        .collection<ShowroomCoupon>("coupons")
        .findOne({ id: userCoupon.couponId }, { session });
      const coupon = userCoupon.couponSnapshot ?? currentCoupon;
      const now = new Date();
      if (
        !coupon ||
        !Number.isFinite(Date.parse(coupon.validUntil)) ||
        Date.parse(coupon.validUntil) <= now.getTime() ||
        userCoupon.status === "EXPIRED"
      ) {
        throw new CouponRedemptionError(
          "사용 기한이 지났거나 종료된 쿠폰입니다.",
          409,
        );
      }
      if (coupon.validFrom && Date.parse(coupon.validFrom) > now.getTime())
        throw new CouponRedemptionError("아직 사용할 수 없는 쿠폰입니다.", 409);
      if (coupon.policyVersion === 2 && coupon.approvalState !== "ACTIVE")
        throw new CouponRedemptionError("승인되지 않은 쿠폰입니다.", 409);
      if (
        !couponAllowsStore(
          coupon,
          store.id,
          joinedStoreIds,
          store.acceptsPlatformCoupons,
        )
      ) {
        throw new CouponRedemptionError(
          `현재 매장(${store.storeName})에서는 사용할 수 없는 쿠폰입니다.`,
          403,
        );
      }
      const usedAt = now.toISOString();
      const usageLogId = `qr_${userCoupon.id}`;
      const updated = await userCoupons.findOneAndUpdate(
        {
          id: userCouponId,
          userId,
          status: { $in: ["ISSUED", "REQUESTED"] },
        },
        {
          $set: {
            status: "USED",
            usedAt,
            usedAtStoreId: store.id,
            usedAtStoreName: store.storeName,
            redemptionShowroomId: store.id,
            usageLogId,
            updatedAt: usedAt,
          },
          $unset: { approvalExpiresAt: "" },
        },
        { session, returnDocument: "after" },
      );
      if (!updated)
        throw new CouponRedemptionError(
          "이미 처리된 쿠폰입니다. 쿠폰함을 다시 확인해 주세요.",
          409,
        );
      const log: CouponUsageLog = {
        id: usageLogId,
        userCouponId,
        couponId: coupon.id,
        userId,
        issuerStoreId: coupon.showroomId,
        storeId: store.id,
        storeName: store.storeName,
        title: coupon.title,
        discountDetail: coupon.discountDetail,
        usageScope: coupon.usageScope ?? "own",
        usedAt,
        method: resources?.processedBy ? "STAFF_QR" : "STORE_QR",
        ...(resources?.processedBy
          ? { processedBy: resources.processedBy }
          : {}),
        ...(coupon.costBearer ? { costBearer: coupon.costBearer } : {}),
        ...(coupon.benefit ? { benefit: coupon.benefit } : {}),
      };
      await db
        .collection<CouponUsageLog & { _id: string }>("coupon_usage_logs")
        .insertOne({ ...log, _id: usageLogId }, { session });
      return { userCoupon: toDomain(updated), store, newlyUsed: true };
    };
    return resources?.session
      ? await execute()
      : await session.withTransaction(execute, {
          readConcern: { level: "snapshot" },
          writeConcern: { w: "majority" },
        });
  } finally {
    if (!resources?.session) await session.endSession();
  }
}
