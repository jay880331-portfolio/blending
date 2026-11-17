import type {
  CommunityEvent,
  CommunityRepository,
  CommunitySnapshot,
  EventReview,
  QaComment,
  QaPost,
  Recipe,
} from "@/domain/community/types";
import {
  getAuthorProfileLookup,
  resolveAuthorName,
  resolveAuthorAvatar,
} from "@/infrastructure/mongodb/authorProfiles";
import { publicContentFilter } from "@/infrastructure/mongodb/adminContentMongoRepository";
import { getMongoDb, toDomain } from "@/infrastructure/mongodb/client";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { ensureSeedData } from "@/infrastructure/mongodb/seed";
import { publicComment } from "@/application/admin/moderationUseCases";
import {
  blockedOwnerFilter,
  countVisibleComments,
  filterBlockedComments,
} from "@/application/community/blockedContent";

type OwnedEventReview = EventReview & { ownerId?: string };
type OwnedCommunityEvent = CommunityEvent & { ownerId?: string };
type OwnedRecipe = Recipe & { ownerId?: string };
type OwnedQaPost = QaPost & { ownerId?: string };

export class CommunityMongoRepository implements CommunityRepository {
  async getSnapshot(
    blockedOwnerIds: string[] = [],
  ): Promise<CommunitySnapshot> {
    await ensureMongoIndexes();
    await ensureSeedData();

    const db = await getMongoDb();
    const [events, reviews, recipes, qaPosts] = await Promise.all([
      db
        .collection<OwnedCommunityEvent>("community_events")
        .find({
          $and: [publicContentFilter, blockedOwnerFilter(blockedOwnerIds)],
        })
        .project<OwnedCommunityEvent>({
          moderationStatus: 0,
          moderationReason: 0,
          moderatedAt: 0,
        })
        .sort({ startsAt: 1 })
        .toArray(),
      db
        .collection<OwnedEventReview>("community_reviews")
        .find({
          $and: [publicContentFilter, blockedOwnerFilter(blockedOwnerIds)],
        })
        .project<OwnedEventReview>({
          moderationStatus: 0,
          moderationReason: 0,
          moderatedAt: 0,
        })
        .sort({ createdAt: -1 })
        .toArray(),
      db
        .collection<OwnedRecipe>("community_b_talk")
        .find({
          $and: [publicContentFilter, blockedOwnerFilter(blockedOwnerIds)],
        })
        .project<OwnedRecipe>({
          moderationStatus: 0,
          moderationReason: 0,
          moderatedAt: 0,
        })
        .sort({ createdAt: -1, id: -1 })
        .toArray(),
      db
        .collection<OwnedQaPost>("community_qa_posts")
        .find({
          $and: [publicContentFilter, blockedOwnerFilter(blockedOwnerIds)],
        })
        .project<OwnedQaPost>({
          moderationStatus: 0,
          moderationReason: 0,
          moderatedAt: 0,
        })
        .sort({ createdAt: -1 })
        .toArray(),
    ]);
    const profileLookup = await getAuthorProfileLookup(db, [
      ...reviews.map((review) => ({
        ownerId: review.ownerId,
        name: review.author.name,
      })),
      ...recipes.map((recipe) => ({
        ownerId: recipe.ownerId,
        name: recipe.author.name,
      })),
      ...qaPosts.map((post) => ({
        ownerId: post.ownerId,
        name: post.authorName,
      })),
    ]);

    return {
      events: events.map((event) =>
        withAuthorId(toDomain(event), event.ownerId),
      ),
      reviews: reviews.map((review) => {
        const domainReview = withAuthorId(toDomain(review), review.ownerId);
        return {
          ...domainReview,
          author: {
            ...domainReview.author,
            name:
              resolveAuthorName(profileLookup, {
                ownerId: review.ownerId,
                name: review.author.name,
              }) ?? review.author.name,
            avatarUrl: resolveAuthorAvatar(profileLookup, {
              ownerId: review.ownerId,
              name: review.author.name,
            }),
          },
        };
      }),
      recipes: recipes.map((recipe) => {
        const domainRecipe = withAuthorId(toDomain(recipe), recipe.ownerId);
        const visibleComments = filterBlockedComments(
          recipe.comments ?? [],
          blockedOwnerIds,
        );
        return {
          ...domainRecipe,
          viewCount: domainRecipe.viewCount ?? 0,
          commentCount: countVisibleComments(visibleComments),
          comments: toPublicComments(visibleComments) as Recipe["comments"],
          author: {
            ...domainRecipe.author,
            name:
              resolveAuthorName(profileLookup, {
                ownerId: recipe.ownerId,
                name: recipe.author.name,
              }) ?? recipe.author.name,
            avatarUrl: resolveAuthorAvatar(profileLookup, {
              ownerId: recipe.ownerId,
              name: recipe.author.name,
            }),
          },
        };
      }),
      qaPosts: qaPosts.map((post) => {
        const visibleComments = filterBlockedComments(
          post.comments,
          blockedOwnerIds,
        );
        return {
          ...withAuthorId(toDomain(post), post.ownerId),
          commentCount: countVisibleComments(visibleComments),
          comments: toPublicComments(visibleComments) as QaPost["comments"],
          viewCount: post.viewCount ?? 0,
          authorAvatarUrl: resolveAuthorAvatar(profileLookup, {
            ownerId: post.ownerId,
            name: post.authorName,
          }),
          authorName:
            resolveAuthorName(profileLookup, {
              ownerId: post.ownerId,
              name: post.authorName,
            }) ?? post.authorName,
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

function toPublicComments(
  comments: Array<{ ownerId?: string; replies?: unknown[] }>,
): QaComment[] {
  return comments.map((comment) => {
    const publicCommentValue = publicComment(
      comment as Record<string, unknown>,
    ) as unknown as QaComment;
    delete (publicCommentValue as { authorId?: unknown }).authorId;
    return {
      ...publicCommentValue,
      ...(!publicCommentValue.isDeleted && comment.ownerId
        ? { authorId: comment.ownerId }
        : {}),
      ...(comment.replies
        ? { replies: toPublicComments(comment.replies as typeof comments) }
        : {}),
    };
  });
}
