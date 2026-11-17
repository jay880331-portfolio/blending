import type { Db } from "mongodb";
import type { EventReview } from "@/domain/community/types";
import type { ReviewWriteRepository } from "@/application/community/createReview";
import { getMongoDb, toDomain } from "./client";

export class ReviewWriteMongoRepository implements ReviewWriteRepository {
  constructor(private readonly getDb: () => Promise<Db> = getMongoDb) {}

  async save(review: EventReview, ownerId: string): Promise<EventReview> {
    const db = await this.getDb();
    const ownedReview = { ...review, ownerId };
    await db
      .collection<typeof ownedReview>("community_reviews")
      .insertOne(ownedReview);
    return toDomain(ownedReview);
  }
}
