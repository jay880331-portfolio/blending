import { communityMock } from "@/infrastructure/mock/community.mock";
import { memberMock } from "@/infrastructure/mock/member.mock";
import { partnerMock } from "@/infrastructure/mock/partner.mock";
import { getMongoDb } from "@/infrastructure/mongodb/client";

let seeded = false;

type SeedItem = {
  collection: string;
  documents: object[];
};

function cloneDocuments<T extends object>(
  documents: T[],
): Array<T & { _createdAt: Date; _updatedAt: Date }> {
  const now = new Date();
  return documents.map((document) => ({
    ...(structuredClone(document) as T),
    _createdAt: now,
    _updatedAt: now,
  }));
}

async function seedCollection(item: SeedItem) {
  const db = await getMongoDb();
  const collection = db.collection(item.collection);
  const count = await collection.estimatedDocumentCount();

  if (count > 0 || item.documents.length === 0) return;
  await collection.insertMany(cloneDocuments(item.documents));
}

export async function ensureSeedData() {
  if (seeded || process.env.BLENDING_SEED_MOCKS !== "true") return;

  const seedItems: SeedItem[] = [
    { collection: "community_events", documents: communityMock.events },
    { collection: "community_reviews", documents: communityMock.reviews },
    { collection: "community_b_talk", documents: communityMock.recipes },
    { collection: "community_qa_posts", documents: communityMock.qaPosts },
    { collection: "partner_banners", documents: partnerMock.banners },
    { collection: "partner_promotions", documents: partnerMock.promotions },
    { collection: "partner_reviews", documents: partnerMock.reviews },
    { collection: "member_profiles", documents: [memberMock.profile] },
    { collection: "member_careers", documents: memberMock.careers },
    { collection: "member_portfolios", documents: memberMock.portfolios },
    { collection: "member_notifications", documents: memberMock.notifications },
    { collection: "member_favorites", documents: memberMock.favorites },
    { collection: "member_recipes", documents: memberMock.recipes },
    { collection: "member_activities", documents: memberMock.myActivities },
  ];

  await Promise.all(seedItems.map(seedCollection));
  seeded = true;
}
