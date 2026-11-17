import type { Db, MongoClient } from "mongodb";
import {
  getMongoClient,
  getMongoDb,
  toDomain,
} from "@/infrastructure/mongodb/client";
import { createId } from "./content";
import {
  benefitLabel,
  canIssueCoupon,
  CouponPolicyError,
  type CouponDraft,
} from "@/domain/showroom/couponPolicy";
import type {
  BaristaShowroom,
  CouponApproval,
  ShowroomCoupon,
  UserCoupon,
} from "@/domain/showroom/types";

type Resources = { db: Db; client: MongoClient };

export async function createCouponCampaign(
  draft: CouponDraft,
  issuer: BaristaShowroom,
  database?: Db,
) {
  const db = database ?? (await getMongoDb());
  const ids =
    draft.usageScope === "ALL"
      ? []
      : draft.usageScope === "SINGLE"
        ? [draft.storeId!]
        : draft.allowedStoreIds!;
  const stores = await db
    .collection<BaristaShowroom>("barista_showrooms")
    .find({ id: { $in: ids } })
    .toArray();
  if (stores.length !== ids.length)
    throw new CouponPolicyError("선택한 매장을 찾을 수 없습니다.");
  const owners = await db
    .collection("users")
    .find({
      id: { $in: stores.map((s) => s.userId) },
      role: { $in: ["barista", "admin"] },
      $or: [{ accountStatus: "active" }, { accountStatus: { $exists: false } }],
    })
    .toArray();
  if (stores.some((s) => !owners.some((owner) => owner.id === s.userId)))
    throw new CouponPolicyError("운영 중인 매장만 선택할 수 있습니다.");
  const now = new Date().toISOString();
  const approvals: CouponApproval[] =
    draft.usageScope === "ALL"
      ? [
          {
            storeId: "platform",
            storeName: "블렌딩 운영자",
            ownerId: "platform",
            status: "PENDING",
          },
        ]
      : stores.map((store) => ({
          storeId: store.id,
          storeName: store.storeName,
          ownerId: store.userId,
          status: store.userId === issuer.userId ? "APPROVED" : "PENDING",
          ...(store.userId === issuer.userId
            ? { decidedAt: now, decidedBy: issuer.userId }
            : {}),
        }));
  const coupon: ShowroomCoupon = {
    ...draft,
    id: createId("coupon"),
    baristaId: issuer.userId,
    showroomId: issuer.id,
    discountDetail: benefitLabel(draft.benefit),
    policyVersion: 2,
    issuedCount: 0,
    approvals,
    approvalState: approvals.every((a) => a.status === "APPROVED")
      ? "ACTIVE"
      : "PENDING",
    createdAt: now,
    updatedAt: now,
  };
  await db.collection<ShowroomCoupon>("coupons").insertOne(coupon);
  return toDomain(coupon);
}

export async function listCouponApprovals(
  userId: string,
  role: string,
  database?: Db,
) {
  const db = database ?? (await getMongoDb());
  return (
    await db
      .collection<ShowroomCoupon>("coupons")
      .find({
        policyVersion: 2,
        approvalState: "PENDING",
        issuanceStoppedAt: { $exists: false },
        approvals: {
          $elemMatch: {
            status: "PENDING",
            ...(role === "admin"
              ? { $or: [{ ownerId: userId }, { ownerId: "platform" }] }
              : { ownerId: userId }),
          },
        },
      })
      .sort({ createdAt: -1 })
      .toArray()
  ).map(toDomain);
}

export async function decideCouponCampaign(
  userId: string,
  role: string,
  couponId: string,
  storeId: string,
  accept: boolean,
  resources?: Resources,
) {
  const db = resources?.db ?? (await getMongoDb());
  const client = resources?.client ?? (await getMongoClient());
  const session = client.startSession();
  try {
    return await session.withTransaction(
      async () => {
        const coupon = await db
          .collection<ShowroomCoupon>("coupons")
          .findOne({ id: couponId, policyVersion: 2 }, { session });
        const approval = coupon?.approvals?.find((a) => a.storeId === storeId);
        if (
          !coupon ||
          !approval ||
          (storeId === "platform"
            ? role !== "admin"
            : approval.ownerId !== userId)
        )
          throw new CouponPolicyError(
            "이 쿠폰의 참여를 결정할 권한이 없습니다.",
            403,
          );
        if (
          storeId !== "platform" &&
          !(await db
            .collection<BaristaShowroom>("barista_showrooms")
            .findOne({ id: storeId, userId }, { session }))
        )
          throw new CouponPolicyError(
            "현재 매장 점주만 참여를 결정할 수 있습니다.",
            403,
          );
        if (approval.status !== "PENDING") {
          if ((approval.status === "APPROVED") === accept)
            return toDomain(coupon);
          throw new CouponPolicyError("이미 처리된 요청입니다.", 409);
        }
        if (coupon.approvalState !== "PENDING" || coupon.issuanceStoppedAt)
          throw new CouponPolicyError("종료된 참여 요청입니다.", 409);
        if (Date.parse(coupon.validUntil) <= Date.now())
          throw new CouponPolicyError("기한이 지난 쿠폰입니다.", 409);
        const now = new Date().toISOString();
        const approvals = coupon.approvals!.map((a) =>
          a.storeId === storeId
            ? {
                ...a,
                status: accept ? ("APPROVED" as const) : ("REJECTED" as const),
                decidedAt: now,
                decidedBy: userId,
              }
            : a,
        );
        const approvalState: ShowroomCoupon["approvalState"] = approvals.some(
          (a) => a.status === "REJECTED",
        )
          ? "REJECTED"
          : approvals.every((a) => a.status === "APPROVED")
            ? "ACTIVE"
            : "PENDING";
        await db
          .collection<ShowroomCoupon>("coupons")
          .updateOne(
            { id: couponId },
            { $set: { approvals, approvalState, updatedAt: now } },
            { session },
          );
        return toDomain({ ...coupon, approvals, approvalState });
      },
      { writeConcern: { w: "majority" } },
    );
  } finally {
    await session.endSession();
  }
}

export async function claimCouponCampaign(
  userId: string,
  couponId: string,
  requestId = "first",
  resources?: Resources,
) {
  if (!/^[\w-]{1,100}$/.test(requestId))
    throw new CouponPolicyError("발급 요청 번호를 확인해 주세요.");
  const db = resources?.db ?? (await getMongoDb());
  const client = resources?.client ?? (await getMongoClient());
  const session = client.startSession();
  // ponytail: 수량 보장을 위해 쿠폰별 쓰기를 직렬화한다. 대규모 동시 발급 시 별도 발급 큐로 전환.
  try {
    return await session.withTransaction(
      async () => {
        const wallets = db.collection<UserCoupon & { _id: string }>(
          "user_coupons",
        );
        const key = JSON.stringify([couponId, userId, requestId]);
        const retry = await wallets.findOne({ _id: key }, { session });
        if (retry) return toDomain(retry);
        const coupon = await db
          .collection<ShowroomCoupon>("coupons")
          .findOne({ id: couponId }, { session });
        if (!coupon || !canIssueCoupon(coupon))
          throw new CouponPolicyError(
            "발급 대기·중단·예정·마감된 쿠폰입니다.",
            409,
          );
        const count = await wallets.countDocuments(
          { userId, couponId },
          { session },
        );
        if (count >= (coupon.perUserLimit ?? 1))
          throw new CouponPolicyError("고객당 발급 한도에 도달했습니다.", 409);
        const now = new Date().toISOString();
        await db
          .collection<ShowroomCoupon>("coupons")
          .updateOne(
            { id: couponId },
            { $inc: { issuedCount: 1 } },
            { session },
          );
        const snapshot = toDomain(coupon);
        const wallet: UserCoupon = {
          id: createId("ucoupon"),
          userId,
          couponId,
          claimRequestId: requestId,
          couponSnapshot: snapshot,
          status: "ISSUED",
          createdAt: now,
          updatedAt: now,
        };
        await wallets.insertOne({ ...wallet, _id: key }, { session });
        return wallet;
      },
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
    );
  } finally {
    await session.endSession();
  }
}
