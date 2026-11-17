import type { NextRequest } from "next/server";
import { resolveTalkAudience } from "@/domain/community/talkAudience";
import type { EventReview, QaPost, Recipe } from "@/domain/community/types";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { publicContentFilter } from "@/infrastructure/mongodb/adminContentMongoRepository";
import { isContentOwner } from "@/infrastructure/server/contentOwnership";
import { CommunityMongoRepository } from "@/infrastructure/mongodb/communityMongoRepository";
import { getAuthorProfileLookup } from "@/infrastructure/mongodb/authorProfiles";
import {
  getLikeIdentity,
  likedTargetIds,
} from "@/infrastructure/server/contentLikes";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { hasAdminRole } from "@/infrastructure/server/authRole";
import { jsonError } from "@/infrastructure/server/http";
import { UserBlockMongoRepository } from "@/infrastructure/mongodb/userBlockMongoRepository";
import { collectCommentIds, markCommentOwnership } from "./commentOwnership";

type OwnedQaPost = QaPost & { ownerId?: string };
type OwnedEventReview = EventReview & { ownerId?: string };
type OwnedRecipe = Recipe & { ownerId?: string };
type OwnedComment = QaPost["comments"][number] & { ownerId?: string };

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const repository = new CommunityMongoRepository();
  const blockedOwnerIds = await new UserBlockMongoRepository().blockedUserIds(
    user.id,
  );
  const snapshot = await repository.getSnapshot(blockedOwnerIds);
  const identity = await getLikeIdentity(request);
  const isAdmin = hasAdminRole(user);
  const db = await getMongoDb();
  const recipeCommentIds = snapshot.recipes.flatMap((recipe) =>
    collectCommentIds(recipe.comments ?? []),
  );
  const qaCommentIds = snapshot.qaPosts.flatMap((post) =>
    collectCommentIds(post.comments),
  );
  const [
    likedRecipes,
    likedQaPosts,
    likedReviews,
    likedRecipeComments,
    likedQaComments,
    ownedReviews,
    ownedRecipes,
    ownedQaPosts,
  ] = await Promise.all([
    likedTargetIds(db, {
      identityKey: identity?.key,
      targetType: "community_b_talk",
      targetIds: snapshot.recipes.map((recipe) => recipe.id),
    }),
    likedTargetIds(db, {
      identityKey: identity?.key,
      targetType: "community_qa",
      targetIds: snapshot.qaPosts.map((post) => post.id),
    }),
    likedTargetIds(db, {
      identityKey: identity?.key,
      targetType: "community_review",
      targetIds: snapshot.reviews.map((review) => review.id),
    }),
    likedTargetIds(db, {
      identityKey: identity?.key,
      targetType: "community_b_talk_comment",
      targetIds: recipeCommentIds,
    }),
    likedTargetIds(db, {
      identityKey: identity?.key,
      targetType: "community_qa_comment",
      targetIds: qaCommentIds,
    }),
    db
      .collection<OwnedEventReview>("community_reviews")
      .find({
        $and: [
          { id: { $in: snapshot.reviews.map((review) => review.id) } },
          publicContentFilter,
        ],
      })
      .project<Pick<OwnedEventReview, "id" | "ownerId" | "author">>({
        id: 1,
        ownerId: 1,
        author: 1,
      })
      .toArray(),
    db
      .collection<OwnedRecipe>("community_b_talk")
      .find({
        $and: [
          { id: { $in: snapshot.recipes.map((recipe) => recipe.id) } },
          publicContentFilter,
        ],
      })
      .project<Pick<OwnedRecipe, "id" | "ownerId" | "author" | "comments">>({
        id: 1,
        ownerId: 1,
        author: 1,
        comments: 1,
      })
      .toArray(),
    db
      .collection<OwnedQaPost>("community_qa_posts")
      .find({
        $and: [
          { id: { $in: snapshot.qaPosts.map((post) => post.id) } },
          publicContentFilter,
        ],
      })
      .project<Pick<OwnedQaPost, "id" | "ownerId" | "authorName">>({
        id: 1,
        ownerId: 1,
        authorName: 1,
      })
      .toArray(),
  ]);
  const reviewOwnershipById = new Map(
    ownedReviews.map((review) => [review.id, review] as const),
  );
  const recipeOwnershipById = new Map(
    ownedRecipes.map((recipe) => [recipe.id, recipe] as const),
  );
  const ownershipById = new Map(
    ownedQaPosts.map((post) => [post.id, post] as const),
  );
  const commentOwnerIds = collectCommentOwnerIds([
    ...snapshot.recipes.flatMap((recipe) => recipe.comments ?? []),
    ...snapshot.qaPosts.flatMap((post) => post.comments),
  ]);
  const [activeCommentUsers, activeCommentProfiles] = commentOwnerIds.length
    ? await Promise.all([
        db
          .collection<{ id: string }>("users")
          .find({ id: { $in: commentOwnerIds } })
          .project<{ id: string }>({ id: 1, _id: 0 })
          .toArray(),
        db
          .collection<{ ownerId?: string }>("member_profiles")
          .find({ ownerId: { $in: commentOwnerIds } })
          .project<{ ownerId?: string }>({ ownerId: 1, _id: 0 })
          .toArray(),
      ])
    : [[], []];
  const activeCommentOwnerIds = new Set([
    ...activeCommentUsers.map((item) => item.id),
    ...activeCommentProfiles.flatMap((item) =>
      item.ownerId ? [item.ownerId] : [],
    ),
  ]);
  const commentProfileLookup = await getAuthorProfileLookup(
    db,
    collectCommentProfileSources([
      ...snapshot.recipes.flatMap((recipe) => recipe.comments ?? []),
      ...snapshot.qaPosts.flatMap((post) => post.comments),
    ]),
  );

  return Response.json(
    {
      ...snapshot,
      viewerRole: user.role,
      events: snapshot.events.map((event) => ({
        ...event,
        isOwner: isContentOwner(event.authorId, user.id),
        canManage: isAdmin || isContentOwner(event.authorId, user.id),
      })),
      reviews: snapshot.reviews.map((review) => ({
        ...review,
        liked: likedReviews.has(review.id),
        isOwner: isAuthoredBy(reviewOwnershipById.get(review.id), user),
        canManage:
          isAdmin || isAuthoredBy(reviewOwnershipById.get(review.id), user),
      })),
      recipes: snapshot.recipes.map((recipe) => ({
        ...recipe,
        audience: resolveTalkAudience(recipe.audience),
        liked: likedRecipes.has(recipe.id),
        isOwner: isAuthoredBy(recipeOwnershipById.get(recipe.id), user),
        canManage:
          isAdmin || isAuthoredBy(recipeOwnershipById.get(recipe.id), user),
        comments: markCommentOwnership(
          recipe.comments ?? [],
          user,
          isAdmin,
          activeCommentOwnerIds,
          commentProfileLookup,
          likedRecipeComments,
        ),
      })),
      qaPosts: snapshot.qaPosts.map((post) => ({
        ...post,
        liked: likedQaPosts.has(post.id),
        isOwner: isQaOwner(ownershipById.get(post.id), user),
        canManage: isAdmin || isQaOwner(ownershipById.get(post.id), user),
        comments: markCommentOwnership(
          post.comments,
          user,
          isAdmin,
          activeCommentOwnerIds,
          commentProfileLookup,
          likedQaComments,
        ),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function collectCommentProfileSources(
  comments: QaPost["comments"],
): Array<{ ownerId?: string; name?: string }> {
  return comments.flatMap((comment) => {
    const ownedComment = comment as OwnedComment;
    return [
      { ownerId: ownedComment.ownerId, name: comment.authorName },
      ...(comment.replies ? collectCommentProfileSources(comment.replies) : []),
    ];
  });
}

function collectCommentOwnerIds(comments: QaPost["comments"]) {
  const ids = new Set<string>();
  const visit = (items: QaPost["comments"]) => {
    for (const comment of items) {
      const ownerId = (comment as OwnedComment).ownerId;
      if (ownerId) ids.add(ownerId);
      if (comment.replies?.length) visit(comment.replies);
    }
  };
  visit(comments);
  return [...ids];
}

function isAuthoredBy(
  item: Pick<OwnedEventReview | OwnedRecipe, "ownerId" | "author"> | undefined,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
) {
  if (!item || !user) return false;
  return isContentOwner(item.ownerId, user.id);
}

function isQaOwner(
  post: Pick<OwnedQaPost, "ownerId" | "authorName"> | undefined,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
) {
  if (!post || !user) return false;
  return isContentOwner(post.ownerId, user.id);
}
