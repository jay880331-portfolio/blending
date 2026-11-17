import type { Db } from "mongodb";
import {
  parseBrewGuideInput,
  type BrewGuide,
} from "@/domain/brewGuide/brewGuide";
import type { ShowroomBean } from "@/domain/showroom/bean";
import type { BaristaShowroom } from "@/domain/showroom/types";
import { getMongoDb, toDomain } from "@/infrastructure/mongodb/client";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { createId, nowIso } from "@/infrastructure/server/content";
import { listCouponStaffStores } from "@/infrastructure/server/couponPresentationRepository";
import { authorizeStoreOwnerOrStaff } from "@/infrastructure/server/storeAuthorization";

type BrewGuideDoc = BrewGuide & { authorId: string };

export class BrewGuideError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "BrewGuideError";
  }
}

async function resolveDb(database?: Db): Promise<Db> {
  if (database) return database;
  await ensureMongoIndexes();
  return getMongoDb();
}

export async function listAuthorizedStoresForBrewGuide(
  userId: string,
  database?: Db,
): Promise<Array<{ id: string; storeName: string }>> {
  const db = await resolveDb(database);
  return listCouponStaffStores(userId, db);
}

async function enrichBrewGuides(
  db: Db,
  rows: BrewGuideDoc[],
): Promise<BrewGuide[]> {
  if (rows.length === 0) return [];
  const storeIds = Array.from(new Set(rows.map((r) => r.storeId)));
  const authorIds = Array.from(new Set(rows.map((r) => r.authorId)));
  const beanIds = Array.from(
    new Set(
      rows.map((r) => r.beanId).filter((id): id is string => Boolean(id)),
    ),
  );

  const stores = await db
    .collection<BaristaShowroom>("barista_showrooms")
    .find({ id: { $in: storeIds } }, { projection: { id: 1, storeName: 1 } })
    .toArray();
  const authors = await db
    .collection<{ id: string; name?: string; handle?: string }>("users")
    .find(
      { id: { $in: authorIds } },
      { projection: { id: 1, name: 1, handle: 1 } },
    )
    .toArray();
  const beans = beanIds.length
    ? await db
        .collection<ShowroomBean>("showroom_beans")
        .find({ id: { $in: beanIds } }, { projection: { id: 1, active: 1 } })
        .toArray()
    : [];

  const storeMap = new Map(stores.map((s) => [s.id, s.storeName]));
  const authorMap = new Map(authors.map((a) => [a.id, a]));
  const beanActiveMap = new Map(beans.map((b) => [b.id, Boolean(b.active)]));

  return rows.map((row) => {
    const { authorId, ...rest } = toDomain(row);
    const author = authorMap.get(authorId);
    return {
      ...rest,
      storeName: storeMap.get(rest.storeId) ?? "매장",
      authorName: author?.name || "탈퇴한 유저",
      authorHandle: author?.handle || "",
      beanActive: rest.beanId ? Boolean(beanActiveMap.get(rest.beanId)) : false,
    };
  });
}

export async function listStoreBrewGuides(
  storeId: string,
  database?: Db,
): Promise<BrewGuide[]> {
  const db = await resolveDb(database);
  const rows = await db
    .collection<BrewGuideDoc>("brew_guides")
    .find({ storeId })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();
  return enrichBrewGuides(db, rows);
}

export async function getBrewGuideById(
  id: string,
  database?: Db,
): Promise<BrewGuide | null> {
  const db = await resolveDb(database);
  const row = await db.collection<BrewGuideDoc>("brew_guides").findOne({ id });
  if (!row) return null;
  const [enriched] = await enrichBrewGuides(db, [row]);
  return enriched ?? null;
}

export async function createBrewGuide(
  userId: string,
  storeId: string,
  rawInput: unknown,
  database?: Db,
): Promise<BrewGuide> {
  const db = await resolveDb(database);
  if (!storeId) {
    throw new BrewGuideError("매장을 선택해주세요.", 400);
  }
  const auth = await authorizeStoreOwnerOrStaff({ userId, storeId, db });
  if (!auth.authorized) {
    if (auth.reason === "store_not_found") {
      throw new BrewGuideError("쇼룸을 찾을 수 없습니다.", 404);
    }
    throw new BrewGuideError("브루 가이드를 작성할 권한이 없습니다.", 403);
  }

  const parsed = parseBrewGuideInput(rawInput);
  if (!parsed.ok) {
    throw new BrewGuideError(parsed.error, 400);
  }

  if (parsed.value.beanId) {
    const bean = await db
      .collection<ShowroomBean>("showroom_beans")
      .findOne({ id: parsed.value.beanId, storeId });
    if (!bean) {
      throw new BrewGuideError("연결할 원두 상품을 찾을 수 없습니다.", 404);
    }
  }

  const timestamp = nowIso();
  const guide: BrewGuideDoc = {
    id: createId("guide"),
    storeId,
    beanId: parsed.value.beanId,
    authorId: userId,
    title: parsed.value.title,
    ...(parsed.value.filter ? { filter: parsed.value.filter } : {}),
    ...(parsed.value.espresso ? { espresso: parsed.value.espresso } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await db.collection<BrewGuideDoc>("brew_guides").insertOne(guide);
  const [enriched] = await enrichBrewGuides(db, [guide]);
  return enriched;
}

export async function updateBrewGuide(
  userId: string,
  id: string,
  rawInput: unknown,
  database?: Db,
): Promise<BrewGuide> {
  const db = await resolveDb(database);
  const existing = await db
    .collection<BrewGuideDoc>("brew_guides")
    .findOne({ id });
  if (!existing) {
    throw new BrewGuideError("브루 가이드를 찾을 수 없습니다.", 404);
  }

  const auth = await authorizeStoreOwnerOrStaff({
    userId,
    storeId: existing.storeId,
    db,
  });
  if (!auth.authorized) {
    throw new BrewGuideError("브루 가이드를 수정할 권한이 없습니다.", 403);
  }

  const parsed = parseBrewGuideInput(rawInput);
  if (!parsed.ok) {
    throw new BrewGuideError(parsed.error, 400);
  }

  if (parsed.value.beanId) {
    const bean = await db
      .collection<ShowroomBean>("showroom_beans")
      .findOne({ id: parsed.value.beanId, storeId: existing.storeId });
    if (!bean) {
      throw new BrewGuideError("연결할 원두 상품을 찾을 수 없습니다.", 404);
    }
  }

  const updatedAt = nowIso();
  const unsetFields: Record<string, ""> = {};
  if (!parsed.value.filter) unsetFields.filter = "";
  if (!parsed.value.espresso) unsetFields.espresso = "";

  const updated = await db
    .collection<BrewGuideDoc>("brew_guides")
    .findOneAndUpdate(
      { id },
      {
        $set: {
          title: parsed.value.title,
          beanId: parsed.value.beanId,
          updatedAt,
          ...(parsed.value.filter ? { filter: parsed.value.filter } : {}),
          ...(parsed.value.espresso ? { espresso: parsed.value.espresso } : {}),
        },
        ...(Object.keys(unsetFields).length > 0 ? { $unset: unsetFields } : {}),
      },
      { returnDocument: "after" },
    );

  if (!updated) {
    throw new BrewGuideError("브루 가이드를 찾을 수 없습니다.", 404);
  }
  const [enriched] = await enrichBrewGuides(db, [updated]);
  return enriched;
}

export async function deleteBrewGuide(
  userId: string,
  id: string,
  database?: Db,
): Promise<void> {
  const db = await resolveDb(database);
  const existing = await db
    .collection<BrewGuideDoc>("brew_guides")
    .findOne({ id });
  if (!existing) {
    throw new BrewGuideError("브루 가이드를 찾을 수 없습니다.", 404);
  }

  const auth = await authorizeStoreOwnerOrStaff({
    userId,
    storeId: existing.storeId,
    db,
  });
  if (!auth.authorized) {
    throw new BrewGuideError("브루 가이드를 삭제할 권한이 없습니다.", 403);
  }

  await db.collection<BrewGuideDoc>("brew_guides").deleteOne({ id });
}
