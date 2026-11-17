import type {
  PartnerBanner,
  PartnerPromotion,
  PartnerRepository,
  PartnerReview,
  PartnerSnapshot,
} from "@/domain/partner/types";
import {
  getAuthorProfileLookup,
  resolveAuthorName,
  resolveAuthorAvatar,
} from "@/infrastructure/mongodb/authorProfiles";
import { publicContentFilter } from "@/infrastructure/mongodb/adminContentMongoRepository";
import { getMongoDb, toDomain } from "@/infrastructure/mongodb/client";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { ensureSeedData } from "@/infrastructure/mongodb/seed";
import { blockedOwnerFilter } from "@/application/community/blockedContent";

type OwnedPartnerPromotion = PartnerPromotion & { ownerId?: string };
type OwnedPartnerReview = PartnerReview & { ownerId?: string };

export function activePartnerBannerFilter(now: string) {
  return {
    $and: [
      publicContentFilter,
      {
        $or: [
          { activeFrom: { $lte: now }, activeTo: { $gt: now } },
          { activeFrom: { $exists: false }, activeTo: { $exists: false } },
        ],
      },
    ],
  };
}

export class PartnerMongoRepository implements PartnerRepository {
  async getSnapshot(blockedOwnerIds: string[] = []): Promise<PartnerSnapshot> {
    await ensureMongoIndexes();
    await ensureSeedData();

    const db = await getMongoDb();
    const now = new Date().toISOString();
    const [banners, promotions, reviews] = await Promise.all([
      db
        .collection<PartnerBanner>("partner_banners")
        .find(activePartnerBannerFilter(now))
        .project<PartnerBanner>({
          moderationStatus: 0,
          moderationReason: 0,
          moderatedAt: 0,
        })
        .sort({ sortOrder: 1, id: 1 })
        .toArray(),
      db
        .collection<OwnedPartnerPromotion>("partner_promotions")
        .find({
          $and: [publicContentFilter, blockedOwnerFilter(blockedOwnerIds)],
        })
        .project<OwnedPartnerPromotion>({
          moderationStatus: 0,
          moderationReason: 0,
          moderatedAt: 0,
        })
        .sort({ createdAt: -1 })
        .toArray(),
      db
        .collection<OwnedPartnerReview>("partner_reviews")
        .find({
          $and: [publicContentFilter, blockedOwnerFilter(blockedOwnerIds)],
        })
        .project<OwnedPartnerReview>({
          moderationStatus: 0,
          moderationReason: 0,
          moderatedAt: 0,
        })
        .sort({ createdAt: -1 })
        .toArray(),
    ]);
    const profileLookup = await getAuthorProfileLookup(db, [
      ...promotions.map((promotion) => ({
        ownerId: promotion.ownerId,
        name: promotion.authorName,
      })),
      ...reviews.map((review) => ({
        ownerId: review.ownerId,
        name: review.reviewer.name,
      })),
    ]);

    return {
      banners: banners.map(toDomain),
      promotions: promotions.map((promotion) => ({
        ...withAuthorId(toDomain(promotion), promotion.ownerId),
        viewCount: promotion.viewCount ?? 0,
        authorName:
          resolveAuthorName(profileLookup, {
            ownerId: promotion.ownerId,
            name: promotion.authorName,
          }) ?? promotion.authorName,
        authorAvatarUrl:
          resolveAuthorAvatar(profileLookup, {
            ownerId: promotion.ownerId,
            name: promotion.authorName,
          }) ?? promotion.authorAvatarUrl,
      })),
      reviews: reviews.map((review) => {
        const domainReview = withAuthorId(toDomain(review), review.ownerId);
        return {
          ...domainReview,
          likes: domainReview.likes ?? 0,
          liked: domainReview.liked ?? false,
          viewCount: domainReview.viewCount ?? 0,
          reviewer: {
            ...domainReview.reviewer,
            name:
              resolveAuthorName(profileLookup, {
                ownerId: review.ownerId,
                name: review.reviewer.name,
              }) ?? review.reviewer.name,
            avatarUrl: resolveAuthorAvatar(profileLookup, {
              ownerId: review.ownerId,
              name: review.reviewer.name,
            }),
          },
        };
      }),
    };
  }
}

function withAuthorId<T extends object>(document: T, ownerId?: string) {
  const publicDocument = { ...document } as T & { authorId?: unknown };
  delete publicDocument.authorId;
  return ownerId ? { ...publicDocument, authorId: ownerId } : publicDocument;
}
