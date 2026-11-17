import { MongoServerError, type Db, type MongoClient } from "mongodb";
import { canWriteShowroom } from "@/domain/showroom/access";
import type { BaristaShowroom } from "@/domain/showroom/types";
import {
  getMongoClient,
  getMongoDb,
  toDomain,
} from "@/infrastructure/mongodb/client";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { createId, nowIso } from "@/infrastructure/server/content";
import { schedulePushNotificationIfEnabled } from "@/infrastructure/server/pushNotifications";
import type { StoreStaffRecord } from "@/infrastructure/server/storeAuthorization";

export type StaffRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type StoreStaffRequest = {
  id: string;
  storeId: string;
  userId: string;
  status: StaffRequestStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  storeName?: string;
  userName?: string;
  userHandle?: string;
};

export class StaffRequestError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "StaffRequestError";
  }
}

type Resources = { db: Db; client: MongoClient };

async function resolveResources(resources?: Resources): Promise<Resources> {
  if (resources) return resources;
  await ensureMongoIndexes();
  const [db, client] = await Promise.all([getMongoDb(), getMongoClient()]);
  return { db, client };
}

async function resolveDb(database?: Db): Promise<Db> {
  if (database) return database;
  await ensureMongoIndexes();
  return getMongoDb();
}

export async function requestStaffJoin(
  userId: string,
  storeId: string,
  options: { db?: Db; skipPush?: boolean } = {},
): Promise<StoreStaffRequest> {
  const db = await resolveDb(options.db);
  const user = await db
    .collection<{
      id: string;
      name?: string;
      role?: string;
      accountStatus?: string;
    }>("users")
    .findOne({ id: userId });

  if (
    !user ||
    !canWriteShowroom(user.role) ||
    (user.accountStatus && user.accountStatus !== "active")
  ) {
    throw new StaffRequestError(
      "활성 바리스타 계정만 직원 가입을 신청할 수 있습니다.",
      403,
    );
  }

  const store = await db
    .collection<BaristaShowroom>("barista_showrooms")
    .findOne({ id: storeId });
  if (!store) {
    throw new StaffRequestError("쇼룸을 찾을 수 없습니다.", 404);
  }

  if (store.userId === userId) {
    throw new StaffRequestError(
      "본인 매장에는 직원 가입을 신청할 수 없습니다.",
      400,
    );
  }

  const existingStaff = await db
    .collection<StoreStaffRecord>("coupon_store_staff")
    .findOne({ storeId, userId, grantedBy: store.userId, active: true });
  if (existingStaff) {
    throw new StaffRequestError("이미 이 매장의 활성 직원입니다.", 409);
  }

  const existingPending = await db
    .collection<StoreStaffRequest>("store_staff_requests")
    .findOne({ storeId, userId, status: "PENDING" });
  if (existingPending) {
    throw new StaffRequestError(
      "이미 처리 대기 중인 직원 신청이 있습니다.",
      409,
    );
  }

  const createdAt = nowIso();
  const requestDoc: StoreStaffRequest = {
    id: createId("sreq"),
    storeId,
    userId,
    status: "PENDING",
    createdAt,
  };

  try {
    await db
      .collection<StoreStaffRequest>("store_staff_requests")
      .insertOne(requestDoc);
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new StaffRequestError(
        "이미 처리 대기 중인 직원 신청이 있습니다.",
        409,
      );
    }
    throw error;
  }

  const notifTitle = `[직원 신청] ${user.name || "바리스타"}님이 ${store.storeName} 직원 등록을 요청했습니다.`;
  await db.collection("member_notifications").insertOne({
    id: createId("notif"),
    ownerId: store.userId,
    kind: "notice",
    title: notifTitle,
    createdAgo: "방금 전",
    createdAt,
    unread: true,
    href: "/showroom/manage",
  });
  if (!options.skipPush) {
    schedulePushNotificationIfEnabled(store.userId, "eventUpdates", {
      title: `${store.storeName} 직원 가입 요청`,
      body: notifTitle,
      data: { href: "/showroom/manage" },
    });
  }

  return {
    ...toDomain(requestDoc),
    storeName: store.storeName,
  };
}

export async function listMyStaffRequests(
  userId: string,
  database?: Db,
): Promise<StoreStaffRequest[]> {
  const db = await resolveDb(database);
  const rows = await db
    .collection<StoreStaffRequest>("store_staff_requests")
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  const storeIds = Array.from(new Set(rows.map((r) => r.storeId)));
  const stores = storeIds.length
    ? await db
        .collection<BaristaShowroom>("barista_showrooms")
        .find(
          { id: { $in: storeIds } },
          { projection: { id: 1, storeName: 1 } },
        )
        .toArray()
    : [];
  const storeMap = new Map(stores.map((s) => [s.id, s.storeName]));

  return rows.map((row) => ({
    ...toDomain(row),
    storeName: storeMap.get(row.storeId) ?? "매장",
  }));
}

export async function listStoreStaffRequests(
  ownerUserId: string,
  database?: Db,
): Promise<StoreStaffRequest[]> {
  const db = await resolveDb(database);
  const store = await db
    .collection<BaristaShowroom>("barista_showrooms")
    .findOne({ userId: ownerUserId }, { projection: { id: 1, storeName: 1 } });
  if (!store) return [];

  const rows = await db
    .collection<StoreStaffRequest>("store_staff_requests")
    .find({ storeId: store.id, status: "PENDING" })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  const userIds = Array.from(new Set(rows.map((r) => r.userId)));
  const users = userIds.length
    ? await db
        .collection<{ id: string; name?: string; handle?: string }>("users")
        .find(
          { id: { $in: userIds } },
          { projection: { id: 1, name: 1, handle: 1 } },
        )
        .toArray()
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  return rows.map((row) => {
    const applicant = userMap.get(row.userId);
    return {
      ...toDomain(row),
      storeName: store.storeName,
      userName: applicant?.name || "바리스타",
      userHandle: applicant?.handle || "",
    };
  });
}

export async function decideStaffRequest(
  ownerUserId: string,
  requestId: string,
  decision: "approve" | "reject",
  options: { resources?: Resources; skipPush?: boolean } = {},
): Promise<StoreStaffRequest> {
  const { db, client } = await resolveResources(options.resources);
  const session = client.startSession();
  const decidedAt = nowIso();
  const nextStatus: StaffRequestStatus =
    decision === "approve" ? "APPROVED" : "REJECTED";

  let resultDoc: StoreStaffRequest | null = null;
  let storeName = "매장";

  try {
    await session.withTransaction(async () => {
      const existing = await db
        .collection<StoreStaffRequest>("store_staff_requests")
        .findOne({ id: requestId }, { session });
      if (!existing) {
        throw new StaffRequestError("직원 신청 내역을 찾을 수 없습니다.", 404);
      }

      const store = await db
        .collection<BaristaShowroom>("barista_showrooms")
        .findOne({ id: existing.storeId }, { session });
      if (!store || store.userId !== ownerUserId) {
        throw new StaffRequestError(
          "매장 소유자만 직원 신청을 처리할 수 있습니다.",
          403,
        );
      }
      storeName = store.storeName;

      const updated = await db
        .collection<StoreStaffRequest>("store_staff_requests")
        .findOneAndUpdate(
          { id: requestId, status: "PENDING" },
          {
            $set: {
              status: nextStatus,
              decidedAt,
              decidedBy: ownerUserId,
            },
          },
          { session, returnDocument: "after" },
        );
      if (!updated) {
        throw new StaffRequestError("이미 처리된 직원 신청입니다.", 409);
      }

      if (decision === "approve") {
        await db.collection<StoreStaffRecord>("coupon_store_staff").updateOne(
          { storeId: existing.storeId, userId: existing.userId },
          {
            $set: {
              grantedBy: ownerUserId,
              active: true,
              updatedAt: decidedAt,
            },
            $setOnInsert: {
              _id: createId("staff"),
            },
          },
          { upsert: true, session },
        );
      }

      resultDoc = toDomain(updated);
    });
  } finally {
    await session.endSession();
  }

  if (!resultDoc) {
    throw new StaffRequestError("직원 신청 처리에 실패했습니다.", 500);
  }
  const finalized = resultDoc as StoreStaffRequest;

  const notifTitle =
    decision === "approve"
      ? `[직원 승인] ${storeName} 매장의 직원으로 등록되었습니다.`
      : `[직원 거절] ${storeName} 매장 직원 신청이 거절되었습니다.`;
  const href =
    decision === "approve" ? "/showroom/scan" : "/showroom/staff-apply";

  await db.collection("member_notifications").insertOne({
    id: createId("notif"),
    ownerId: finalized.userId,
    kind: "notice",
    title: notifTitle,
    createdAgo: "방금 전",
    createdAt: decidedAt,
    unread: true,
    href,
  });
  if (!options.skipPush) {
    schedulePushNotificationIfEnabled(finalized.userId, "eventUpdates", {
      title: decision === "approve" ? "직원 등록 승인" : "직원 등록 거절",
      body: notifTitle,
      data: { href },
    });
  }

  return {
    ...finalized,
    storeName,
  };
}

export async function cancelMyStaffRequest(
  userId: string,
  requestId: string,
  database?: Db,
): Promise<StoreStaffRequest> {
  const db = await resolveDb(database);
  const existing = await db
    .collection<StoreStaffRequest>("store_staff_requests")
    .findOne({ id: requestId, userId });
  if (!existing) {
    throw new StaffRequestError("직원 신청 내역을 찾을 수 없습니다.", 404);
  }

  const updated = await db
    .collection<StoreStaffRequest>("store_staff_requests")
    .findOneAndUpdate(
      { id: requestId, userId, status: "PENDING" },
      { $set: { status: "CANCELLED", decidedAt: nowIso(), decidedBy: userId } },
      { returnDocument: "after" },
    );
  if (!updated) {
    throw new StaffRequestError("이미 처리된 신청은 취소할 수 없습니다.", 409);
  }
  return toDomain(updated);
}
