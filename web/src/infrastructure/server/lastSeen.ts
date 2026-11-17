import type { Collection } from "mongodb";
import type { UserDocument } from "@/infrastructure/server/auth";
import { activeAccountFilter } from "@/infrastructure/server/accountStatus";
import { getMongoDb } from "@/infrastructure/mongodb/client";

export const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

export async function recordLastSeen(
  users: Pick<Collection<UserDocument>, "updateOne">,
  {
    userId,
    now,
    throttleMs = LAST_SEEN_THROTTLE_MS,
  }: {
    userId: string;
    now: Date;
    throttleMs?: number;
  },
) {
  const cutoff = new Date(now.getTime() - throttleMs);
  const result = await users.updateOne(
    {
      id: userId,
      $and: [
        activeAccountFilter(),
        {
          $or: [
            { lastSeenAt: { $exists: false } },
            { lastSeenAt: { $lte: cutoff } },
          ],
        },
      ],
    },
    { $set: { lastSeenAt: now } },
  );
  return { updated: result.matchedCount === 1 };
}

export async function recordCurrentUserLastSeen(
  userId: string,
  now = new Date(),
) {
  const db = await getMongoDb();
  return recordLastSeen(db.collection<UserDocument>("users"), { userId, now });
}
