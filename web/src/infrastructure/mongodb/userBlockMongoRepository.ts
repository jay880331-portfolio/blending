import type { ClientSession } from "mongodb";
import type { UserBlockRepository } from "@/application/community/userBlockUseCases";
import { getMongoDb } from "./client";

export class UserBlockMongoRepository implements UserBlockRepository {
  async userExists(userId: string) {
    return Boolean(
      await (await getMongoDb())
        .collection("users")
        .findOne({ id: userId }, { projection: { _id: 1 } }),
    );
  }

  async create(blockerId: string, blockedId: string, session?: ClientSession) {
    await (await getMongoDb()).collection("user_blocks").updateOne(
      { blockerId, blockedId },
      {
        $setOnInsert: {
          blockerId,
          blockedId,
          createdAt: new Date().toISOString(),
        },
      },
      { upsert: true, ...(session ? { session } : {}) },
    );
  }

  async remove(blockerId: string, blockedId: string) {
    await (await getMongoDb())
      .collection("user_blocks")
      .deleteOne({ blockerId, blockedId });
  }

  async blockedUserIds(blockerId: string) {
    return (await getMongoDb())
      .collection<{ blockedId: string }>("user_blocks")
      .distinct("blockedId", { blockerId });
  }

  async isBlocked(blockerId: string, blockedId: string) {
    return Boolean(
      await (await getMongoDb())
        .collection("user_blocks")
        .findOne({ blockerId, blockedId }, { projection: { _id: 1 } }),
    );
  }
}
