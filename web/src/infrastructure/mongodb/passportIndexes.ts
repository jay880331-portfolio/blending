import type { Db } from "mongodb";

export async function ensurePassportIndexes(db: Db) {
  await Promise.all([
    db
      .collection("passport_presentations")
      .createIndex(
        { tokenHash: 1 },
        { unique: true, name: "passport_presentations_token_hash" },
      ),
    db
      .collection("passport_presentations")
      .createIndex(
        { purgeAt: 1 },
        { expireAfterSeconds: 0, name: "passport_presentations_purge" },
      ),
    db
      .collection("passport_presentations")
      .createIndex(
        { userId: 1, status: 1 },
        { name: "passport_presentations_user_status" },
      ),
    db
      .collection("passport_stamps")
      .createIndex(
        { userId: 1, storeId: 1, kstDate: 1 },
        { unique: true, name: "passport_stamps_user_store_date" },
      ),
    db
      .collection("passport_stamps")
      .createIndex(
        { userId: 1, createdAt: -1 },
        { name: "passport_stamps_user_recent" },
      ),
    db
      .collection("passport_stamps")
      .createIndex(
        { storeId: 1, createdAt: -1 },
        { name: "passport_stamps_store_recent" },
      ),
    db
      .collection("point_ledger")
      .createIndex(
        { userId: 1, expiresAt: 1 },
        { name: "point_ledger_user_expires" },
      ),
    db
      .collection("point_ledger")
      .createIndex(
        { type: 1, refId: 1 },
        { unique: true, name: "point_ledger_type_ref" },
      ),
    db
      .collection("point_ledger")
      .createIndex(
        { userId: 1, createdAt: -1 },
        { name: "point_ledger_user_recent" },
      ),
    db
      .collection("point_redemptions")
      .createIndex(
        { userId: 1, createdAt: -1 },
        { name: "point_redemptions_user_recent" },
      ),
    db
      .collection("point_redemptions")
      .createIndex(
        { storeId: 1, createdAt: -1 },
        { name: "point_redemptions_store_recent" },
      ),
    db
      .collection("store_reviews")
      .createIndex(
        { stampId: 1 },
        { unique: true, name: "store_reviews_stamp" },
      ),
    db
      .collection("store_reviews")
      .createIndex(
        { storeId: 1, createdAt: -1 },
        { name: "store_reviews_store_recent" },
      ),
    db
      .collection("showroom_beans")
      .createIndex({ id: 1 }, { unique: true, name: "showroom_beans_id" }),
    db
      .collection("showroom_beans")
      .createIndex(
        { storeId: 1, active: 1, createdAt: -1 },
        { name: "showroom_beans_store_active" },
      ),
    db
      .collection("bean_reservations")
      .createIndex({ id: 1 }, { unique: true, name: "bean_reservations_id" }),
    db
      .collection("bean_reservations")
      .createIndex(
        { userId: 1, createdAt: -1 },
        { name: "bean_reservations_user_recent" },
      ),
    db
      .collection("bean_reservations")
      .createIndex(
        { storeId: 1, status: 1, createdAt: -1 },
        { name: "bean_reservations_store_status" },
      ),
    db.collection("bean_reservations").createIndex(
      { userId: 1, beanId: 1, pickupDate: 1 },
      {
        unique: true,
        partialFilterExpression: { status: "REQUESTED" },
        name: "bean_reservations_user_bean_date_requested",
      },
    ),
    db
      .collection("brew_guides")
      .createIndex({ id: 1 }, { unique: true, name: "brew_guides_id" }),
    db
      .collection("brew_guides")
      .createIndex(
        { storeId: 1, createdAt: -1 },
        { name: "brew_guides_store_recent" },
      ),
    db
      .collection("brew_guides")
      .createIndex({ beanId: 1 }, { name: "brew_guides_bean" }),
    db
      .collection("store_staff_requests")
      .createIndex(
        { id: 1 },
        { unique: true, name: "store_staff_requests_id" },
      ),
    db.collection("store_staff_requests").createIndex(
      { storeId: 1, userId: 1 },
      {
        unique: true,
        partialFilterExpression: { status: "PENDING" },
        name: "store_staff_requests_store_user_pending",
      },
    ),
    db
      .collection("store_staff_requests")
      .createIndex(
        { storeId: 1, status: 1, createdAt: -1 },
        { name: "store_staff_requests_store_status" },
      ),
    db
      .collection("store_staff_requests")
      .createIndex(
        { userId: 1, createdAt: -1 },
        { name: "store_staff_requests_user_recent" },
      ),
  ]);
}
