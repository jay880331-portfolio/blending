import type { NextRequest } from "next/server";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { publicContentFilter } from "@/infrastructure/mongodb/adminContentMongoRepository";
import { isContentOwner } from "@/infrastructure/server/contentOwnership";
import { PartnerMongoRepository } from "@/infrastructure/mongodb/partnerMongoRepository";
import {
  getLikeIdentity,
  likedTargetIds,
} from "@/infrastructure/server/contentLikes";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { hasAdminRole } from "@/infrastructure/server/authRole";
import { jsonError } from "@/infrastructure/server/http";
import type { MemberProfile } from "@/domain/member/types";
import type { PartnerPromotion, PartnerReview } from "@/domain/partner/types";
import { UserBlockMongoRepository } from "@/infrastructure/mongodb/userBlockMongoRepository";

type OwnedPartnerReview = PartnerReview & { ownerId?: string };
type CurrentProfile = Pick<MemberProfile, "name" | "handle" | "avatarUrl">;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const repository = new PartnerMongoRepository();
  const blockedOwnerIds = await new UserBlockMongoRepository().blockedUserIds(
    user.id,
  );
  const snapshot = await repository.getSnapshot(blockedOwnerIds);
  const identity = await getLikeIdentity(request);
  const isAdmin = hasAdminRole(user);
  const db = await getMongoDb();
  const [likedPromotions, likedReviews, ownedReviews, currentProfile] =
    await Promise.all([
      likedTargetIds(db, {
        identityKey: identity?.key,
        targetType: "partner_promotion",
        targetIds: snapshot.promotions.map((promotion) => promotion.id),
      }),
      likedTargetIds(db, {
        identityKey: identity?.key,
        targetType: "partner_review",
        targetIds: snapshot.reviews.map((review) => review.id),
      }),
      db
        .collection<OwnedPartnerReview>("partner_reviews")
        .find({
          $and: [
            { id: { $in: snapshot.reviews.map((review) => review.id) } },
            publicContentFilter,
          ],
        })
        .project<Pick<OwnedPartnerReview, "id" | "ownerId" | "reviewer">>({
          id: 1,
          ownerId: 1,
          reviewer: 1,
        })
        .toArray(),
      db
        .collection<CurrentProfile & { ownerId?: string }>("member_profiles")
        .findOne(
          { ownerId: user.id },
          { projection: { name: 1, handle: 1, avatarUrl: 1 } },
        ),
    ]);
  const reviewOwnershipById = new Map(
    ownedReviews.map((review) => [review.id, review] as const),
  );

  return Response.json(
    {
      ...snapshot,
      isAdmin,
      promotions: snapshot.promotions.map((promotion) => ({
        ...promotion,
        authorAvatarUrl:
          promotion.authorAvatarUrl ??
          currentProfilePromotionAvatar(promotion, currentProfile),
        liked: likedPromotions.has(promotion.id),
        isOwner: isPromotionOwner(promotion, user),
      })),
      reviews: snapshot.reviews.map((review) => ({
        ...review,
        liked: likedReviews.has(review.id),
        isOwner: isReviewOwner(reviewOwnershipById.get(review.id), user),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function currentProfilePromotionAvatar(
  promotion: Pick<PartnerPromotion, "authorName" | "companyName">,
  profile: CurrentProfile | null,
) {
  if (!profile?.avatarUrl) return undefined;
  const profileNames = new Set([profile.name, profile.handle].filter(Boolean));
  return profileNames.has(promotion.authorName) ||
    profileNames.has(promotion.companyName)
    ? profile.avatarUrl
    : undefined;
}

function isReviewOwner(
  review: Pick<OwnedPartnerReview, "ownerId" | "reviewer"> | undefined,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
) {
  if (!review || !user) return false;
  return isContentOwner(review.ownerId, user.id);
}

function isPromotionOwner(
  promotion: Pick<PartnerPromotion, "authorId">,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
) {
  return Boolean(user && isContentOwner(promotion.authorId, user.id));
}
