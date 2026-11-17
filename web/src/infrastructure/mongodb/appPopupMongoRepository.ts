import { randomUUID } from "node:crypto";
import type {
  AdminAppPopupDto,
  AppPopupDto,
  AppPopupPlacement,
} from "@blending/admin-contracts";
import type { Filter } from "mongodb";
import type {
  AdminAppPopupRepository,
  AppPopupQueryRepository,
} from "@/application/admin/appPopupUseCases";
import { getMongoDb } from "./client";

type AppPopupDocument = AdminAppPopupDto;

export const APP_POPUP_SORT = { priority: 1, createdAt: 1 } as const;

export function activeAppPopupFilter(
  placement: AppPopupPlacement,
  now: string,
): Filter<AppPopupDocument> {
  return {
    enabled: true,
    startsAt: { $lte: now },
    endsAt: { $gt: now },
    placements: placement,
  };
}

export const appPopupMongoRepository: AdminAppPopupRepository &
  AppPopupQueryRepository = {
  async list() {
    const db = await getMongoDb();
    return db
      .collection<AppPopupDocument>("app_popups")
      .find({}, { projection: { _id: 0 } })
      .sort(APP_POPUP_SORT)
      .toArray();
  },

  async findById(id) {
    const db = await getMongoDb();
    return db
      .collection<AppPopupDocument>("app_popups")
      .findOne({ id }, { projection: { _id: 0 } });
  },

  async create(input, session) {
    const db = await getMongoDb();
    const now = new Date().toISOString();
    const document: AppPopupDocument = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await db.collection<AppPopupDocument>("app_popups").insertOne(document, {
      session,
    });
    return document;
  },

  async update(id, input, session) {
    const db = await getMongoDb();
    const collection = db.collection<AppPopupDocument>("app_popups");
    const result = await collection.updateOne(
      { id },
      { $set: { ...input, updatedAt: new Date().toISOString() } },
      { session },
    );
    if (!result.matchedCount) return null;
    return collection.findOne({ id }, { projection: { _id: 0 }, session });
  },

  async delete(id, session) {
    const db = await getMongoDb();
    const popup = await db
      .collection<AppPopupDocument>("app_popups")
      .findOneAndDelete({ id }, { projection: { _id: 0 }, session });
    return popup ? { ...popup, id: popup.id } : null;
  },

  async setEnabled(id, enabled, session) {
    const db = await getMongoDb();
    const collection = db.collection<AppPopupDocument>("app_popups");
    const result = await collection.updateOne(
      { id },
      { $set: { enabled, updatedAt: new Date().toISOString() } },
      { session },
    );
    if (!result.matchedCount) return null;
    return collection.findOne({ id }, { projection: { _id: 0 }, session });
  },

  async listActive(placement, now) {
    const db = await getMongoDb();
    return db
      .collection<AppPopupDocument>("app_popups")
      .find(activeAppPopupFilter(placement, now))
      .project<AppPopupDto>({
        _id: 0,
        id: 1,
        imageUrl: 1,
        imageAlt: 1,
        href: 1,
      })
      .sort(APP_POPUP_SORT)
      .toArray();
  },
};
