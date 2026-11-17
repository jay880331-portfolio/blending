import type { ClientSession, Db } from "mongodb";
import { canWriteShowroom } from "@/domain/showroom/access";
import type { BaristaShowroom } from "@/domain/showroom/types";

export type StoreStaffRecord = {
  _id: string;
  storeId: string;
  userId: string;
  grantedBy: string;
  active: boolean;
  updatedAt?: string;
};

export type StoreAuthorizationResult =
  | {
      authorized: true;
      store: BaristaShowroom;
      staff: StoreStaffRecord | null;
      isOwner: boolean;
    }
  | {
      authorized: false;
      reason: "store_not_found" | "forbidden";
    };

export async function authorizeStoreOwnerOrStaff({
  userId,
  storeId,
  db,
  session,
}: {
  userId: string;
  storeId: string;
  db: Db;
  session?: ClientSession;
}): Promise<StoreAuthorizationResult> {
  const store = await db
    .collection<BaristaShowroom>("barista_showrooms")
    .findOne({ id: storeId }, { session });
  if (!store) {
    return { authorized: false, reason: "store_not_found" };
  }

  const user = await db
    .collection("users")
    .findOne({ id: userId }, { session });
  const owner = await db
    .collection("users")
    .findOne({ id: store.userId }, { session });
  const staff =
    store.userId === userId
      ? null
      : await db
          .collection<StoreStaffRecord>("coupon_store_staff")
          .findOne(
            { storeId, userId, grantedBy: store.userId, active: true },
            { session },
          );

  if (
    !user ||
    !canWriteShowroom(user.role) ||
    (user.accountStatus && user.accountStatus !== "active") ||
    !owner ||
    !canWriteShowroom(owner.role) ||
    (owner.accountStatus && owner.accountStatus !== "active") ||
    (store.userId !== userId && !staff)
  ) {
    return { authorized: false, reason: "forbidden" };
  }

  return {
    authorized: true,
    store,
    staff,
    isOwner: store.userId === userId,
  };
}
