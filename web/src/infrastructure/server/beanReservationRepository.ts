import { MongoServerError, type Db } from "mongodb";
import {
  canStoreRunPassport,
  PASSPORT_BUSINESS_VERIFICATION_REQUIRED_MESSAGE,
} from "@/domain/passport/ledger";
import { canWriteShowroom } from "@/domain/showroom/access";
import {
  canTransitionReservation,
  parseBeanInput,
  parseReservationInput,
  RESERVATION_REJECT_REASON_MAX_LENGTH,
  type BeanReservation,
  type ReservationStatus,
  type ShowroomBean,
} from "@/domain/showroom/bean";
import type { BaristaShowroom } from "@/domain/showroom/types";
import { getMongoDb, toDomain } from "@/infrastructure/mongodb/client";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { createId, nowIso } from "@/infrastructure/server/content";
import { schedulePushNotificationIfEnabled } from "@/infrastructure/server/pushNotifications";
import { authorizeStoreOwnerOrStaff } from "@/infrastructure/server/storeAuthorization";

export class BeanReservationError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "BeanReservationError";
  }
}

async function resolveDb(database?: Db): Promise<Db> {
  if (database) return database;
  await ensureMongoIndexes();
  return getMongoDb();
}

async function insertMemberNotification(
  db: Db,
  {
    ownerId,
    title,
    href,
  }: {
    ownerId: string;
    title: string;
    href: string;
  },
) {
  await db.collection("member_notifications").insertOne({
    id: createId("notif"),
    ownerId,
    kind: "reservation",
    title,
    createdAgo: "방금 전",
    createdAt: nowIso(),
    unread: true,
    href,
  });
}

// ----------------------------------------------------
// Bean CRUD (Owner Only)
// ----------------------------------------------------

export async function listStoreBeans(
  storeId: string,
  options: { includeInactive?: boolean; db?: Db } = {},
): Promise<ShowroomBean[]> {
  const db = await resolveDb(options.db);
  const filter = options.includeInactive
    ? { storeId }
    : { storeId, active: true };
  const rows = await db
    .collection<ShowroomBean>("showroom_beans")
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  return rows.map(toDomain);
}

async function requireStoreOwner(
  db: Db,
  userId: string,
  storeId: string,
): Promise<BaristaShowroom> {
  const [user, store] = await Promise.all([
    db
      .collection<{
        id: string;
        role?: string;
        accountStatus?: string;
      }>("users")
      .findOne({ id: userId }),
    db
      .collection<BaristaShowroom>("barista_showrooms")
      .findOne({ id: storeId }),
  ]);
  if (!store) {
    throw new BeanReservationError("쇼룸을 찾을 수 없습니다.", 404);
  }
  if (
    !user ||
    !canWriteShowroom(user.role) ||
    (user.accountStatus && user.accountStatus !== "active") ||
    store.userId !== userId
  ) {
    throw new BeanReservationError(
      "쇼룸 소유자만 상품을 관리할 수 있습니다.",
      403,
    );
  }
  return toDomain(store);
}

export async function createStoreBean(
  userId: string,
  storeId: string,
  rawInput: unknown,
  database?: Db,
): Promise<ShowroomBean> {
  const db = await resolveDb(database);
  await requireStoreOwner(db, userId, storeId);

  const parsed = parseBeanInput(rawInput);
  if (!parsed.ok) {
    throw new BeanReservationError(parsed.error, 400);
  }

  const now = nowIso();
  const bean: ShowroomBean = {
    id: createId("bean"),
    storeId,
    baristaId: userId,
    ...parsed.value,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection<ShowroomBean>("showroom_beans").insertOne(bean);
  return toDomain(bean);
}

export async function updateStoreBean(
  userId: string,
  storeId: string,
  beanId: string,
  rawInput: unknown,
  database?: Db,
): Promise<ShowroomBean> {
  const db = await resolveDb(database);
  await requireStoreOwner(db, userId, storeId);

  const existing = await db
    .collection<ShowroomBean>("showroom_beans")
    .findOne({ id: beanId, storeId });
  if (!existing) {
    throw new BeanReservationError("원두·드립백 상품을 찾을 수 없습니다.", 404);
  }

  const merged = {
    kind: existing.kind,
    name: existing.name,
    notes: existing.notes,
    unit: existing.unit,
    price: existing.price,
    grindOptions: existing.grindOptions,
    active: existing.active,
    ...(rawInput && typeof rawInput === "object" ? rawInput : {}),
  };

  const parsed = parseBeanInput(merged);
  if (!parsed.ok) {
    throw new BeanReservationError(parsed.error, 400);
  }

  const updatedAt = nowIso();
  const updated = await db
    .collection<ShowroomBean>("showroom_beans")
    .findOneAndUpdate(
      { id: beanId, storeId },
      { $set: { ...parsed.value, updatedAt } },
      { returnDocument: "after" },
    );
  if (!updated) {
    throw new BeanReservationError("원두·드립백 상품을 찾을 수 없습니다.", 404);
  }
  return toDomain(updated);
}

export async function deleteStoreBean(
  userId: string,
  storeId: string,
  beanId: string,
  database?: Db,
): Promise<void> {
  const db = await resolveDb(database);
  await requireStoreOwner(db, userId, storeId);

  const res = await db
    .collection<ShowroomBean>("showroom_beans")
    .deleteOne({ id: beanId, storeId });
  if (res.deletedCount === 0) {
    throw new BeanReservationError("원두·드립백 상품을 찾을 수 없습니다.", 404);
  }
}

// ----------------------------------------------------
// Bean Reservations
// ----------------------------------------------------

export async function createBeanReservation(
  userId: string,
  storeId: string,
  rawInput: unknown,
  options: { db?: Db; skipPush?: boolean } = {},
): Promise<BeanReservation> {
  const db = await resolveDb(options.db);
  const store = await db
    .collection<BaristaShowroom>("barista_showrooms")
    .findOne({ id: storeId });
  if (!store) {
    throw new BeanReservationError("쇼룸을 찾을 수 없습니다.", 404);
  }
  if (!canStoreRunPassport(store)) {
    throw new BeanReservationError(
      PASSPORT_BUSINESS_VERIFICATION_REQUIRED_MESSAGE,
      403,
    );
  }

  const beanId =
    rawInput &&
    typeof rawInput === "object" &&
    typeof (rawInput as { beanId?: unknown }).beanId === "string"
      ? (rawInput as { beanId: string }).beanId
      : "";
  if (!beanId) {
    throw new BeanReservationError("예약할 상품을 선택해주세요.", 400);
  }

  const bean = await db
    .collection<ShowroomBean>("showroom_beans")
    .findOne({ id: beanId, storeId });
  if (!bean || !bean.active) {
    throw new BeanReservationError("현재 예약 가능한 상품이 아닙니다.", 404);
  }

  const now = new Date();
  const parsed = parseReservationInput(rawInput, bean, now);
  if (!parsed.ok) {
    throw new BeanReservationError(parsed.error, 400);
  }

  const duplicate = await db
    .collection<BeanReservation>("bean_reservations")
    .findOne({
      userId,
      beanId,
      pickupDate: parsed.value.pickupDate,
      status: "REQUESTED",
    });
  if (duplicate) {
    throw new BeanReservationError(
      "같은 날짜에 이미 요청 중인 예약이 있습니다.",
      409,
    );
  }

  const timestamp = now.toISOString();
  const reservation: BeanReservation = {
    id: createId("resv"),
    userId,
    storeId,
    beanId,
    beanSnapshot: {
      name: bean.name,
      kind: bean.kind,
      unit: bean.unit,
      price: bean.price,
    },
    grind: parsed.value.grind,
    quantity: parsed.value.quantity,
    pickupDate: parsed.value.pickupDate,
    note: parsed.value.note,
    status: "REQUESTED",
    createdAt: timestamp,
    updatedAt: timestamp,
    history: [{ status: "REQUESTED", by: userId, at: timestamp }],
  };

  try {
    await db
      .collection<BeanReservation>("bean_reservations")
      .insertOne(reservation);
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new BeanReservationError(
        "같은 날짜에 이미 요청 중인 예약이 있습니다.",
        409,
      );
    }
    throw error;
  }

  const notifTitle = `[원두 예약] ${bean.name} ${parsed.value.quantity}개 (${parsed.value.pickupDate} 픽업)`;
  await insertMemberNotification(db, {
    ownerId: store.userId,
    title: notifTitle,
    href: "/showroom/manage#reservations",
  });
  if (!options.skipPush) {
    schedulePushNotificationIfEnabled(store.userId, "eventUpdates", {
      title: `${store.storeName} 새 원두 예약`,
      body: notifTitle,
      data: { href: "/showroom/manage#reservations" },
    });
  }

  return {
    ...toDomain(reservation),
    storeName: store.storeName,
  };
}

export async function listStoreReservations(
  staffUserId: string,
  storeId: string,
  database?: Db,
): Promise<BeanReservation[]> {
  const db = await resolveDb(database);
  const auth = await authorizeStoreOwnerOrStaff({
    userId: staffUserId,
    storeId,
    db,
  });
  if (!auth.authorized) {
    if (auth.reason === "store_not_found") {
      throw new BeanReservationError("쇼룸을 찾을 수 없습니다.", 404);
    }
    throw new BeanReservationError(
      "이 매장의 예약함을 볼 권한이 없습니다.",
      403,
    );
  }

  const rows = await db
    .collection<BeanReservation>("bean_reservations")
    .find({ storeId })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  const userIds = Array.from(new Set(rows.map((r) => r.userId)));
  const customers = userIds.length
    ? await db
        .collection<{ id: string; name?: string }>("users")
        .find({ id: { $in: userIds } }, { projection: { id: 1, name: 1 } })
        .toArray()
    : [];
  const nameMap = new Map(customers.map((c) => [c.id, c.name || "회원"]));

  return rows.map((row) => ({
    ...toDomain(row),
    storeName: auth.store.storeName,
    customerName: nameMap.get(row.userId) || "회원",
  }));
}

export async function listMemberReservations(
  userId: string,
  database?: Db,
): Promise<BeanReservation[]> {
  const db = await resolveDb(database);
  const rows = await db
    .collection<BeanReservation>("bean_reservations")
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
  const storeNameMap = new Map(stores.map((s) => [s.id, s.storeName]));

  return rows.map((row) => ({
    ...toDomain(row),
    storeName: storeNameMap.get(row.storeId) ?? "매장",
  }));
}

const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  REQUESTED: "요청됨",
  CONFIRMED: "예약 확정",
  REJECTED: "예약 거절",
  PICKED_UP: "픽업 완료",
  CANCELLED: "예약 취소",
};

export async function transitionBeanReservation(
  {
    actorUserId,
    reservationId,
    nextStatus,
    rejectReason,
  }: {
    actorUserId: string;
    reservationId: string;
    nextStatus: ReservationStatus;
    rejectReason?: string;
  },
  options: { db?: Db; skipPush?: boolean } = {},
): Promise<BeanReservation> {
  const db = await resolveDb(options.db);
  const existing = await db
    .collection<BeanReservation>("bean_reservations")
    .findOne({ id: reservationId });
  if (!existing) {
    throw new BeanReservationError("예약 내역을 찾을 수 없습니다.", 404);
  }

  let actorRole: "customer" | "staff";
  let storeName = "매장";
  let storeOwnerId = "";

  if (actorUserId === existing.userId && nextStatus === "CANCELLED") {
    actorRole = "customer";
    const store = await db
      .collection<BaristaShowroom>("barista_showrooms")
      .findOne(
        { id: existing.storeId },
        { projection: { storeName: 1, userId: 1 } },
      );
    storeName = store?.storeName ?? "매장";
    storeOwnerId = store?.userId ?? "";
  } else {
    if (actorUserId === existing.userId) {
      throw new BeanReservationError(
        "본인의 예약은 직접 처리할 수 없습니다.",
        403,
      );
    }
    const auth = await authorizeStoreOwnerOrStaff({
      userId: actorUserId,
      storeId: existing.storeId,
      db,
    });
    if (!auth.authorized) {
      throw new BeanReservationError("이 예약을 처리할 권한이 없습니다.", 403);
    }
    actorRole = "staff";
    storeName = auth.store.storeName;
    storeOwnerId = auth.store.userId;
  }

  const check = canTransitionReservation({
    currentStatus: existing.status,
    nextStatus,
    actorRole,
    pickupDate: existing.pickupDate,
  });
  if (!check.ok) {
    throw new BeanReservationError(check.error, check.status);
  }

  const trimmedReason = rejectReason?.trim();
  if (
    trimmedReason &&
    [...trimmedReason].length > RESERVATION_REJECT_REASON_MAX_LENGTH
  ) {
    throw new BeanReservationError(
      `거절 사유는 ${RESERVATION_REJECT_REASON_MAX_LENGTH}자 이하로 입력해주세요.`,
      400,
    );
  }
  const at = nowIso();
  const updated = await db
    .collection<BeanReservation>("bean_reservations")
    .findOneAndUpdate(
      { id: reservationId, status: existing.status },
      {
        $set: {
          status: nextStatus,
          updatedAt: at,
          ...(nextStatus === "REJECTED" && trimmedReason
            ? { rejectReason: trimmedReason }
            : {}),
        },
        $push: {
          history: { status: nextStatus, by: actorUserId, at },
        },
      },
      { returnDocument: "after" },
    );

  if (!updated) {
    throw new BeanReservationError(
      "이미 처리된 예약입니다. 새로고침 후 확인해주세요.",
      409,
    );
  }

  if (actorRole === "customer" && storeOwnerId) {
    const title = `[예약 취소] ${existing.beanSnapshot.name} (${existing.pickupDate})`;
    await insertMemberNotification(db, {
      ownerId: storeOwnerId,
      title,
      href: "/showroom/manage#reservations",
    });
    if (!options.skipPush) {
      schedulePushNotificationIfEnabled(storeOwnerId, "eventUpdates", {
        title: `${storeName} 원두 예약 취소`,
        body: title,
        data: { href: "/showroom/manage#reservations" },
      });
    }
  } else if (actorRole === "staff") {
    const label = RESERVATION_STATUS_LABELS[nextStatus];
    const title = `[${label}] ${storeName} · ${existing.beanSnapshot.name} (${existing.pickupDate})`;
    await insertMemberNotification(db, {
      ownerId: existing.userId,
      title,
      href: "/passport#reservations",
    });
    if (!options.skipPush) {
      schedulePushNotificationIfEnabled(existing.userId, "eventUpdates", {
        title: `${storeName} ${label}`,
        body: title,
        data: { href: "/passport#reservations" },
      });
    }
  }

  return {
    ...toDomain(updated),
    storeName,
  };
}
