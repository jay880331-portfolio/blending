import { createHash, randomBytes } from "node:crypto";
import {
  MongoServerError,
  type ClientSession,
  type Db,
  type MongoClient,
} from "mongodb";
import {
  allocatePointsFifo,
  calculateAvailablePoints,
  canStoreRunPassport,
  computePointExpiresAt,
  PASSPORT_BUSINESS_VERIFICATION_REQUIRED_MESSAGE,
  REVIEW_POINTS,
  STAMP_POINTS,
  toKstDateKey,
  validateReviewBody,
} from "@/domain/passport/ledger";
import type {
  PassportPresentationPurpose,
  PassportScanConfirmResult,
  PassportSummaryData,
  StoreReviewItem,
} from "@/domain/passport/types";
import type { BaristaShowroom, ShowroomMenu } from "@/domain/showroom/types";
import { getMongoClient, getMongoDb } from "@/infrastructure/mongodb/client";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { createId } from "@/infrastructure/server/content";
import { authorizeStoreOwnerOrStaff } from "@/infrastructure/server/storeAuthorization";

export class PassportError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "PassportError";
  }
}

export type {
  PassportPresentationPurpose,
  PassportScanConfirmResult,
  PassportSummaryData,
  StoreReviewItem,
};

export type PassportPresentationDoc = {
  _id: string;
  userId: string;
  tokenHash: string;
  purpose: PassportPresentationPurpose;
  redeem?: {
    storeId: string;
    menuId: string;
    menuName: string;
    points: number;
  };
  expiresAt: Date;
  purgeAt: Date;
  status: "OPEN" | "USED" | "CANCELLED";
  usedAt?: string;
  usedBy?: string;
  usedAtStoreId?: string;
  result?: PassportScanConfirmResult;
  createdAt: string;
};

export type PassportStampDoc = {
  _id: string;
  userId: string;
  storeId: string;
  kstDate: string;
  processedBy: string;
  createdAt: string;
};

export type PointLedgerDoc = {
  _id: string;
  userId: string;
  type: "STAMP" | "REVIEW" | "REDEEM";
  amount: number;
  remaining?: number;
  storeId: string;
  refId: string;
  processedBy?: string;
  createdAt: string;
  expiresAt?: string;
};

export type PointRedemptionDoc = {
  _id: string;
  userId: string;
  storeId: string;
  menuId: string;
  menuName: string;
  points: number;
  processedBy: string;
  createdAt: string;
  allocations: Array<{ ledgerId: string; amount: number }>;
};

export type StoreReviewDoc = {
  _id: string;
  userId: string;
  storeId: string;
  stampId: string;
  body: string;
  createdAt: string;
  hidden?: boolean;
};

type Resources = { db: Db; client: MongoClient };

const PRESENTATION_TTL_MS = 60 * 1000;
const PRESENTATION_PURGE_MS = 24 * 60 * 60 * 1000;

function sha256(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function resolveResources(resources?: Resources): Promise<Resources> {
  if (resources) return resources;
  await ensureMongoIndexes();
  const [db, client] = await Promise.all([getMongoDb(), getMongoClient()]);
  return { db, client };
}

export async function getActiveLedgerEntries(
  db: Db,
  userId: string,
  now = new Date(),
  session?: ClientSession,
): Promise<PointLedgerDoc[]> {
  const nowIsoStr = now.toISOString();
  return db
    .collection<PointLedgerDoc>("point_ledger")
    .find(
      {
        userId,
        amount: { $gt: 0 },
        remaining: { $gt: 0 },
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: nowIsoStr } },
        ],
      },
      { session },
    )
    .toArray();
}

export async function createPassportPresentation(
  userId: string,
  input: {
    purpose: PassportPresentationPurpose;
    storeId?: string;
    menuId?: string;
  },
  resources?: Resources,
) {
  const { db } = await resolveResources(resources);
  const now = new Date();

  let redeem: PassportPresentationDoc["redeem"] | undefined;
  if (input.purpose === "REDEEM") {
    if (!input.storeId?.trim() || !input.menuId?.trim()) {
      throw new PassportError("교환할 매장과 메뉴를 선택해주세요.", 400);
    }
    const store = await db
      .collection<BaristaShowroom>("barista_showrooms")
      .findOne({ id: input.storeId });
    if (!store) {
      throw new PassportError("매장을 찾을 수 없습니다.", 404);
    }
    if (!canStoreRunPassport(store)) {
      throw new PassportError(
        PASSPORT_BUSINESS_VERIFICATION_REQUIRED_MESSAGE,
        403,
      );
    }
    const stamp = await db
      .collection<PassportStampDoc>("passport_stamps")
      .findOne({ userId, storeId: store.id });
    if (!stamp) {
      throw new PassportError(
        "이 매장의 스탬프가 있어야 음료 교환이 가능합니다.",
        403,
      );
    }
    const menu = await db
      .collection<ShowroomMenu>("menus")
      .findOne({ id: input.menuId, showroomId: store.id });
    if (!menu || menu.exchangePoints == null) {
      throw new PassportError("교환 가능한 메뉴가 아닙니다.", 400);
    }
    const activeEntries = await getActiveLedgerEntries(db, userId, now);
    const balance = calculateAvailablePoints(activeEntries, now);
    if (balance < menu.exchangePoints) {
      throw new PassportError("포인트 잔액이 부족합니다.", 400);
    }
    redeem = {
      storeId: store.id,
      menuId: menu.id,
      menuName: menu.name,
      points: menu.exchangePoints,
    };
  }

  const presentations = db.collection<PassportPresentationDoc>(
    "passport_presentations",
  );
  await presentations.updateMany(
    { userId, status: "OPEN" },
    { $set: { status: "CANCELLED" } },
  );

  const token = randomBytes(32).toString("base64url");
  const presentationId = createId("ppres");
  const expiresAt = new Date(now.getTime() + PRESENTATION_TTL_MS);
  const purgeAt = new Date(now.getTime() + PRESENTATION_PURGE_MS);

  await presentations.insertOne({
    _id: presentationId,
    userId,
    tokenHash: sha256(token),
    purpose: input.purpose,
    ...(redeem ? { redeem } : {}),
    expiresAt,
    purgeAt,
    status: "OPEN",
    createdAt: now.toISOString(),
  });

  return {
    presentationId,
    token,
    expiresAt: expiresAt.toISOString(),
    purpose: input.purpose,
    ...(redeem ? { redeem } : {}),
  };
}

export async function cancelPassportPresentation(
  userId: string,
  token: string,
  resources?: Resources,
) {
  const { db } = await resolveResources(resources);
  await db
    .collection<PassportPresentationDoc>("passport_presentations")
    .updateOne(
      { userId, tokenHash: sha256(token), status: "OPEN" },
      { $set: { status: "CANCELLED" } },
    );
}

export async function getPassportPresentationStatus(
  userId: string,
  presentationId: string,
  resources?: Resources,
) {
  const { db } = await resolveResources(resources);
  const pres = await db
    .collection<PassportPresentationDoc>("passport_presentations")
    .findOne({ _id: presentationId, userId });
  if (!pres) {
    throw new PassportError("여권 QR 정보를 찾을 수 없습니다.", 404);
  }
  return {
    id: pres._id,
    status: pres.status,
    purpose: pres.purpose,
    expiresAt: pres.expiresAt.toISOString(),
    ...(pres.result ? { result: pres.result } : {}),
  };
}

export async function inspectPassportPresentation(
  staffUserId: string,
  storeId: string,
  token: string,
  resources?: Resources,
) {
  const { db } = await resolveResources(resources);
  const auth = await authorizeStoreOwnerOrStaff({
    userId: staffUserId,
    storeId,
    db,
  });
  if (!auth.authorized) {
    throw new PassportError("이 매장의 여권 QR을 처리할 권한이 없습니다.", 403);
  }
  if (!canStoreRunPassport(auth.store)) {
    throw new PassportError(
      PASSPORT_BUSINESS_VERIFICATION_REQUIRED_MESSAGE,
      403,
    );
  }

  const pres = await db
    .collection<PassportPresentationDoc>("passport_presentations")
    .findOne({ tokenHash: sha256(token) });
  if (!pres) {
    throw new PassportError("유효하지 않은 여권 QR입니다.", 404);
  }
  if (pres.userId === staffUserId) {
    throw new PassportError("본인 여권은 처리할 수 없습니다.", 403);
  }
  if (pres.status !== "OPEN") {
    throw new PassportError("이미 사용되었거나 취소된 QR입니다.", 409);
  }
  const now = new Date();
  if (pres.expiresAt.getTime() <= now.getTime()) {
    throw new PassportError("QR 유효 시간이 지났습니다.", 409);
  }

  const customer = await db
    .collection<{ id: string; name?: string }>("users")
    .findOne({ id: pres.userId }, { projection: { name: 1 } });

  if (pres.purpose === "STAMP") {
    const kstDate = toKstDateKey(now);
    const existingStamp = await db
      .collection<PassportStampDoc>("passport_stamps")
      .findOne({ userId: pres.userId, storeId, kstDate });
    if (existingStamp) {
      throw new PassportError("오늘 이미 적립한 매장입니다.", 409);
    }
    return {
      purpose: "STAMP" as const,
      storeId: auth.store.id,
      storeName: auth.store.storeName,
      customerName: customer?.name || "고객",
      points: STAMP_POINTS,
      kstDate,
    };
  }

  if (!pres.redeem || pres.redeem.storeId !== storeId) {
    throw new PassportError("다른 매장의 음료 교환 QR입니다.", 403);
  }
  const stamp = await db
    .collection<PassportStampDoc>("passport_stamps")
    .findOne({ userId: pres.userId, storeId });
  if (!stamp) {
    throw new PassportError(
      "이 매장의 스탬프가 있어야 음료 교환이 가능합니다.",
      403,
    );
  }
  const menu = await db
    .collection<ShowroomMenu>("menus")
    .findOne({ id: pres.redeem.menuId, showroomId: storeId });
  if (!menu || menu.exchangePoints !== pres.redeem.points) {
    throw new PassportError(
      "메뉴 교환 포인트 설정이 변경되었습니다. 새 QR을 생성해 주세요.",
      409,
    );
  }
  const activeEntries = await getActiveLedgerEntries(db, pres.userId, now);
  const balance = calculateAvailablePoints(activeEntries, now);
  if (balance < pres.redeem.points) {
    throw new PassportError("포인트 잔액이 부족합니다.", 409);
  }

  return {
    purpose: "REDEEM" as const,
    storeId: auth.store.id,
    storeName: auth.store.storeName,
    customerName: customer?.name || "고객",
    menuId: menu.id,
    menuName: menu.name,
    points: pres.redeem.points,
  };
}

export async function confirmPassportPresentation(
  staffUserId: string,
  storeId: string,
  token: string,
  resources?: Resources,
): Promise<PassportScanConfirmResult> {
  const { db, client } = await resolveResources(resources);
  const session = client.startSession();
  const tokenHash = sha256(token);

  try {
    return await session.withTransaction(
      async () => {
        const auth = await authorizeStoreOwnerOrStaff({
          userId: staffUserId,
          storeId,
          db,
          session,
        });
        if (!auth.authorized) {
          throw new PassportError(
            "이 매장의 여권 QR을 처리할 권한이 없습니다.",
            403,
          );
        }
        if (!canStoreRunPassport(auth.store)) {
          throw new PassportError(
            PASSPORT_BUSINESS_VERIFICATION_REQUIRED_MESSAGE,
            403,
          );
        }

        const presentations = db.collection<PassportPresentationDoc>(
          "passport_presentations",
        );
        const pres = await presentations.findOne({ tokenHash }, { session });
        if (!pres) {
          throw new PassportError("유효하지 않은 여권 QR입니다.", 404);
        }
        if (pres.userId === staffUserId) {
          throw new PassportError("본인 여권은 처리할 수 없습니다.", 403);
        }

        if (pres.status === "USED") {
          if (
            pres.usedBy === staffUserId &&
            pres.usedAtStoreId === storeId &&
            pres.result
          ) {
            return { ...pres.result, newlyProcessed: false };
          }
          throw new PassportError("이미 사용된 QR입니다.", 409);
        }

        if (pres.status !== "OPEN") {
          throw new PassportError(
            "이미 취소되었거나 사용할 수 없는 QR입니다.",
            409,
          );
        }

        const now = new Date();
        if (pres.expiresAt.getTime() <= now.getTime()) {
          throw new PassportError("QR 유효 시간이 지났습니다.", 409);
        }

        const nowIsoStr = now.toISOString();

        if (auth.staff && !auth.isOwner) {
          await db.collection("coupon_store_staff").updateOne(
            {
              _id: auth.staff._id as unknown as never,
              active: true,
              grantedBy: auth.store.userId,
            },
            { $set: { updatedAt: nowIsoStr } },
            { session },
          );
        }

        if (pres.purpose === "STAMP") {
          const kstDate = toKstDateKey(now);
          const stampId = createId("stamp");

          try {
            await db.collection<PassportStampDoc>("passport_stamps").insertOne(
              {
                _id: stampId,
                userId: pres.userId,
                storeId,
                kstDate,
                processedBy: staffUserId,
                createdAt: nowIsoStr,
              },
              { session },
            );
          } catch (error) {
            if (error instanceof MongoServerError && error.code === 11000) {
              throw new PassportError("오늘 이미 적립한 매장입니다.", 409);
            }
            throw error;
          }

          await db.collection<PointLedgerDoc>("point_ledger").insertOne(
            {
              _id: createId("pledger"),
              userId: pres.userId,
              type: "STAMP",
              amount: STAMP_POINTS,
              remaining: STAMP_POINTS,
              storeId,
              refId: stampId,
              processedBy: staffUserId,
              createdAt: nowIsoStr,
              expiresAt: computePointExpiresAt(now).toISOString(),
            },
            { session },
          );

          const result: PassportScanConfirmResult = {
            newlyProcessed: true,
            purpose: "STAMP",
            stampId,
            storeId,
            storeName: auth.store.storeName,
            points: STAMP_POINTS,
            kstDate,
            createdAt: nowIsoStr,
          };

          const updatedPres = await presentations.findOneAndUpdate(
            { _id: pres._id, status: "OPEN" },
            {
              $set: {
                status: "USED",
                usedAt: nowIsoStr,
                usedBy: staffUserId,
                usedAtStoreId: storeId,
                result,
              },
            },
            { session, returnDocument: "after" },
          );
          if (!updatedPres) {
            throw new PassportError("이미 처리된 여권 QR입니다.", 409);
          }

          return result;
        }

        if (!pres.redeem || pres.redeem.storeId !== storeId) {
          throw new PassportError("다른 매장의 음료 교환 QR입니다.", 403);
        }

        const stamp = await db
          .collection<PassportStampDoc>("passport_stamps")
          .findOne({ userId: pres.userId, storeId }, { session });
        if (!stamp) {
          throw new PassportError(
            "이 매장의 스탬프가 있어야 음료 교환이 가능합니다.",
            403,
          );
        }

        const menu = await db
          .collection<ShowroomMenu>("menus")
          .findOne(
            { id: pres.redeem.menuId, showroomId: storeId },
            { session },
          );
        if (!menu || menu.exchangePoints !== pres.redeem.points) {
          throw new PassportError(
            "메뉴 교환 포인트 설정이 변경되었습니다. 새 QR을 생성해 주세요.",
            409,
          );
        }

        const activeEntries = await getActiveLedgerEntries(
          db,
          pres.userId,
          now,
          session,
        );
        const allocation = allocatePointsFifo(
          activeEntries,
          pres.redeem.points,
          now,
        );
        if (!allocation.ok) {
          throw new PassportError(allocation.error, 409);
        }

        const ledger = db.collection<PointLedgerDoc>("point_ledger");
        for (const item of allocation.allocations) {
          const dec = await ledger.updateOne(
            { _id: item.ledgerId, remaining: { $gte: item.amount } },
            { $inc: { remaining: -item.amount } },
            { session },
          );
          if (dec.matchedCount !== 1) {
            throw new PassportError(
              "포인트 차감 중 충돌이 발생했습니다. 다시 시도해 주세요.",
              409,
            );
          }
        }

        const redeemId = createId("predeem");
        await db.collection<PointRedemptionDoc>("point_redemptions").insertOne(
          {
            _id: redeemId,
            userId: pres.userId,
            storeId,
            menuId: menu.id,
            menuName: menu.name,
            points: pres.redeem.points,
            processedBy: staffUserId,
            createdAt: nowIsoStr,
            allocations: allocation.allocations,
          },
          { session },
        );

        await ledger.insertOne(
          {
            _id: createId("pledger"),
            userId: pres.userId,
            type: "REDEEM",
            amount: -pres.redeem.points,
            storeId,
            refId: redeemId,
            processedBy: staffUserId,
            createdAt: nowIsoStr,
          },
          { session },
        );

        const result: PassportScanConfirmResult = {
          newlyProcessed: true,
          purpose: "REDEEM",
          redeemId,
          storeId,
          storeName: auth.store.storeName,
          menuId: menu.id,
          menuName: menu.name,
          points: pres.redeem.points,
          createdAt: nowIsoStr,
        };

        const updatedPres = await presentations.findOneAndUpdate(
          { _id: pres._id, status: "OPEN" },
          {
            $set: {
              status: "USED",
              usedAt: nowIsoStr,
              usedBy: staffUserId,
              usedAtStoreId: storeId,
              result,
            },
          },
          { session, returnDocument: "after" },
        );
        if (!updatedPres) {
          throw new PassportError("이미 처리된 여권 QR입니다.", 409);
        }

        return result;
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      },
    );
  } finally {
    await session.endSession();
  }
}

export async function createVerifiedStoreReview(
  {
    userId,
    storeId,
    body,
  }: {
    userId: string;
    storeId: string;
    body: string;
  },
  resources?: Resources,
) {
  const validated = validateReviewBody(body);
  if (!validated.ok) {
    throw new PassportError(validated.error, 400);
  }

  const { db, client } = await resolveResources(resources);
  const session = client.startSession();

  try {
    return await session.withTransaction(
      async () => {
        const store = await db
          .collection<BaristaShowroom>("barista_showrooms")
          .findOne({ id: storeId }, { session });
        if (!store) {
          throw new PassportError("매장을 찾을 수 없습니다.", 404);
        }
        if (!canStoreRunPassport(store)) {
          throw new PassportError(
            PASSPORT_BUSINESS_VERIFICATION_REQUIRED_MESSAGE,
            403,
          );
        }

        const stamps = await db
          .collection<PassportStampDoc>("passport_stamps")
          .find({ userId, storeId }, { session })
          .sort({ createdAt: -1 })
          .toArray();
        if (stamps.length === 0) {
          throw new PassportError(
            "이 매장의 스탬프가 있어야 방문 인증 리뷰를 작성할 수 있습니다.",
            403,
          );
        }

        const stampIds = stamps.map((s) => s._id);
        const existingReviews = await db
          .collection<StoreReviewDoc>("store_reviews")
          .find(
            { stampId: { $in: stampIds } },
            { session, projection: { stampId: 1 } },
          )
          .toArray();
        const reviewedStampIds = new Set(existingReviews.map((r) => r.stampId));
        const targetStamp = stamps.find((s) => !reviewedStampIds.has(s._id));
        if (!targetStamp) {
          throw new PassportError("이미 리뷰를 작성한 스탬프입니다.", 409);
        }

        const now = new Date();
        const nowIsoStr = now.toISOString();
        const reviewId = createId("sreview");

        await db.collection<StoreReviewDoc>("store_reviews").insertOne(
          {
            _id: reviewId,
            userId,
            storeId,
            stampId: targetStamp._id,
            body: validated.body,
            createdAt: nowIsoStr,
          },
          { session },
        );

        await db.collection<PointLedgerDoc>("point_ledger").insertOne(
          {
            _id: createId("pledger"),
            userId,
            type: "REVIEW",
            amount: REVIEW_POINTS,
            remaining: REVIEW_POINTS,
            storeId,
            refId: reviewId,
            createdAt: nowIsoStr,
            expiresAt: computePointExpiresAt(now).toISOString(),
          },
          { session },
        );

        return {
          id: reviewId,
          storeId,
          stampId: targetStamp._id,
          body: validated.body,
          createdAt: nowIsoStr,
          pointsEarned: REVIEW_POINTS,
        };
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      },
    );
  } finally {
    await session.endSession();
  }
}

export async function getPassportSummary(
  userId: string,
  resources?: Resources,
): Promise<PassportSummaryData> {
  const { db } = await resolveResources(resources);
  const now = new Date();

  const [activeEntries, stamps, recentLedgerDocs] = await Promise.all([
    getActiveLedgerEntries(db, userId, now),
    db
      .collection<PassportStampDoc>("passport_stamps")
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray(),
    db
      .collection<PointLedgerDoc>("point_ledger")
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray(),
  ]);

  const balance = calculateAvailablePoints(activeEntries, now);

  const storeIds = Array.from(
    new Set([
      ...stamps.map((s) => s.storeId),
      ...recentLedgerDocs.map((l) => l.storeId),
    ]),
  );
  const [stores, menus] = storeIds.length
    ? await Promise.all([
        db
          .collection<BaristaShowroom>("barista_showrooms")
          .find(
            { id: { $in: storeIds } },
            { projection: { id: 1, storeName: 1, businessVerification: 1 } },
          )
          .toArray(),
        db
          .collection<ShowroomMenu>("menus")
          .find({
            showroomId: { $in: storeIds },
            exchangePoints: { $gt: 0 },
          })
          .toArray(),
      ])
    : [[], []];

  const storeNameMap = new Map(stores.map((s) => [s.id, s.storeName]));
  const verifiedStoreIds = new Set(
    stores.filter((s) => canStoreRunPassport(s)).map((s) => s.id),
  );
  const menusByStore = new Map<
    string,
    Array<{ id: string; name: string; exchangePoints: number }>
  >();
  for (const menu of menus) {
    if (menu.exchangePoints == null) continue;
    if (!verifiedStoreIds.has(menu.showroomId)) continue;
    const list = menusByStore.get(menu.showroomId) ?? [];
    list.push({
      id: menu.id,
      name: menu.name,
      exchangePoints: menu.exchangePoints,
    });
    menusByStore.set(menu.showroomId, list);
  }

  const stampMap = new Map<
    string,
    { stampCount: number; latestKstDate: string }
  >();
  for (const stamp of stamps) {
    const existing = stampMap.get(stamp.storeId);
    if (!existing) {
      stampMap.set(stamp.storeId, {
        stampCount: 1,
        latestKstDate: stamp.kstDate,
      });
    } else {
      existing.stampCount += 1;
      if (stamp.kstDate > existing.latestKstDate) {
        existing.latestKstDate = stamp.kstDate;
      }
    }
  }

  const stampedStores = Array.from(stampMap.entries()).map(
    ([storeId, info]) => ({
      storeId,
      storeName: storeNameMap.get(storeId) ?? "매장",
      stampCount: info.stampCount,
      latestKstDate: info.latestKstDate,
      businessVerified: verifiedStoreIds.has(storeId),
      exchangeableMenus: menusByStore.get(storeId) ?? [],
    }),
  );

  const recentLedger = recentLedgerDocs.map((entry) => ({
    id: entry._id,
    type: entry.type,
    amount: entry.amount,
    ...(entry.remaining !== undefined ? { remaining: entry.remaining } : {}),
    storeId: entry.storeId,
    storeName: storeNameMap.get(entry.storeId) ?? "매장",
    createdAt: entry.createdAt,
    ...(entry.expiresAt ? { expiresAt: entry.expiresAt } : {}),
  }));

  return {
    balance,
    totalStamps: stamps.length,
    stampedStores,
    recentLedger,
  };
}

export async function listStoreReviews(
  storeId: string,
  viewerUserId: string,
  resources?: Resources,
): Promise<{ reviews: StoreReviewItem[]; canWriteReview: boolean }> {
  const { db } = await resolveResources(resources);

  const [rawReviews, viewerStamps] = await Promise.all([
    db
      .collection<StoreReviewDoc>("store_reviews")
      .find({ storeId, hidden: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray(),
    db
      .collection<PassportStampDoc>("passport_stamps")
      .find({ userId: viewerUserId, storeId }, { projection: { _id: 1 } })
      .toArray(),
  ]);

  let canWriteReview = false;
  if (viewerStamps.length > 0) {
    const stampIds = viewerStamps.map((s) => s._id);
    const writtenCount = await db
      .collection<StoreReviewDoc>("store_reviews")
      .countDocuments({ stampId: { $in: stampIds } });
    canWriteReview = writtenCount < stampIds.length;
  }

  const authorIds = Array.from(new Set(rawReviews.map((r) => r.userId)));
  const authors = authorIds.length
    ? await db
        .collection<{ id: string; name?: string; avatarUrl?: string }>("users")
        .find(
          { id: { $in: authorIds } },
          { projection: { id: 1, name: 1, avatarUrl: 1 } },
        )
        .toArray()
    : [];
  const authorMap = new Map(authors.map((a) => [a.id, a]));

  const reviews: StoreReviewItem[] = rawReviews.map((review) => {
    const author = authorMap.get(review.userId);
    return {
      id: review._id,
      userId: review.userId,
      authorName: author?.name || "회원",
      ...(author?.avatarUrl ? { authorAvatarUrl: author.avatarUrl } : {}),
      body: review.body,
      createdAt: review.createdAt,
    };
  });

  return { reviews, canWriteReview };
}
