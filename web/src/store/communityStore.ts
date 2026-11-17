"use client";

import { create } from "zustand";
import type {
  CategoryFilter,
  CommunitySnapshot,
  EventCategory,
  QaComment,
} from "@/domain/community/types";
import { fetchCommunitySnapshot } from "@/adapters/http/communityApi";
import type { ContentViewTargetType } from "@/adapters/http/contentViews";
import {
  countComments,
  filterBlockedUserComments,
  filterBlockedUserItems,
} from "@/ui/shared/blockedUserEvent";

const DELETED_COMMENT_BODY = "삭제된 댓글이에요.";

type CommunityStore = {
  snapshot?: CommunitySnapshot;
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  eventFilter: CategoryFilter;
  reviewFilter: CategoryFilter;
  calendarMonth: Date;
  selectedReviewCategory: EventCategory;
  selectedKeywords: string[];
  recipeLikes: Record<string, { liked: boolean; likes: number }>;
  qaLikes: Record<string, { liked: boolean; likes: number }>;
  reviewLikes: Record<string, { liked: boolean; likes: number }>;
  load: (options?: { force?: boolean }) => Promise<void>;
  setEventFilter: (filter: CategoryFilter) => void;
  setReviewFilter: (filter: CategoryFilter) => void;
  shiftCalendarMonth: (delta: number) => void;
  setSelectedReviewCategory: (category: EventCategory) => void;
  toggleKeyword: (keyword: string) => void;
  toggleRecipeLike: (
    recipeId: string,
    baseLikes: number,
    baseLiked: boolean,
  ) => void;
  toggleQaLike: (
    postId: string,
    baseLikes: number,
    baseLiked?: boolean,
  ) => void;
  toggleReviewLike: (
    reviewId: string,
    baseLikes: number,
    baseLiked?: boolean,
  ) => void;
  setContentViewCount: (
    targetType: Extract<
      ContentViewTargetType,
      "community_b_talk" | "community_qa" | "community_review"
    >,
    targetId: string,
    viewCount: number,
  ) => void;
  addQaComment: (postId: string, comment: QaComment) => void;
  addQaReply: (postId: string, commentId: string, reply: QaComment) => void;
  updateQaComment: (postId: string, commentId: string, body: string) => void;
  removeQaComment: (postId: string, commentId: string) => void;
  addRecipeComment: (recipeId: string, comment: QaComment) => void;
  addRecipeReply: (
    recipeId: string,
    commentId: string,
    reply: QaComment,
  ) => void;
  updateRecipeComment: (
    recipeId: string,
    commentId: string,
    body: string,
  ) => void;
  removeRecipeComment: (recipeId: string, commentId: string) => void;
  removeEvent: (eventId: string) => void;
  removeReview: (reviewId: string) => void;
  removeRecipe: (recipeId: string) => void;
  removeQaPost: (postId: string) => void;
  removeBlockedUser: (userId: string) => void;
};

export const useCommunityStore = create<CommunityStore>()((set, get) => ({
  status: "idle",
  eventFilter: "all",
  reviewFilter: "all",
  calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedReviewCategory: "official",
  selectedKeywords: [
    "#라떼아트세미나",
    "#커핑세미나",
    "#에스프레소추출",
    "#로스팅팁",
  ],
  recipeLikes: {},
  qaLikes: {},
  reviewLikes: {},
  load: async (options) => {
    if (
      get().status === "loading" ||
      (!options?.force && get().status === "ready")
    )
      return;

    set({ status: "loading", error: undefined });

    try {
      const snapshot = await fetchCommunitySnapshot();
      set({ snapshot, status: "ready" });
    } catch (error) {
      set({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "데이터를 불러오지 못했습니다.",
      });
    }
  },
  setEventFilter: (filter) =>
    set((state) => ({
      eventFilter: state.eventFilter === filter ? "all" : filter,
    })),
  setReviewFilter: (filter) =>
    set((state) => ({
      reviewFilter: state.reviewFilter === filter ? "all" : filter,
    })),
  shiftCalendarMonth: (delta) =>
    set((state) => ({
      calendarMonth: new Date(
        state.calendarMonth.getFullYear(),
        state.calendarMonth.getMonth() + delta,
        1,
      ),
    })),
  setSelectedReviewCategory: (category) =>
    set({ selectedReviewCategory: category }),
  toggleKeyword: (keyword) =>
    set((state) => {
      const exists = state.selectedKeywords.includes(keyword);
      if (!exists && state.selectedKeywords.length >= 6) {
        window.alert("키워드는 최대 6개까지 선택할 수 있습니다.");
        return state;
      }

      return {
        selectedKeywords: exists
          ? state.selectedKeywords.filter((selected) => selected !== keyword)
          : [...state.selectedKeywords, keyword],
      };
    }),
  toggleRecipeLike: (recipeId, baseLikes, baseLiked) =>
    set((state) => {
      const current = state.recipeLikes[recipeId] ?? {
        liked: baseLiked,
        likes: baseLikes,
      };
      const liked = !current.liked;
      return {
        recipeLikes: {
          ...state.recipeLikes,
          [recipeId]: {
            liked,
            likes: current.likes + (liked ? 1 : -1),
          },
        },
      };
    }),
  toggleQaLike: (postId, baseLikes, baseLiked = false) =>
    set((state) => {
      const current = state.qaLikes[postId] ?? {
        liked: baseLiked,
        likes: baseLikes,
      };
      const liked = !current.liked;
      return {
        qaLikes: {
          ...state.qaLikes,
          [postId]: {
            liked,
            likes: current.likes + (liked ? 1 : -1),
          },
        },
      };
    }),
  toggleReviewLike: (reviewId, baseLikes, baseLiked = false) =>
    set((state) => {
      const current = state.reviewLikes[reviewId] ?? {
        liked: baseLiked,
        likes: baseLikes,
      };
      const liked = !current.liked;
      return {
        reviewLikes: {
          ...state.reviewLikes,
          [reviewId]: {
            liked,
            likes: current.likes + (liked ? 1 : -1),
          },
        },
      };
    }),
  setContentViewCount: (targetType, targetId, viewCount) =>
    set((state) => ({
      snapshot: state.snapshot
        ? {
            ...state.snapshot,
            recipes:
              targetType === "community_b_talk"
                ? state.snapshot.recipes.map((recipe) =>
                    recipe.id === targetId ? { ...recipe, viewCount } : recipe,
                  )
                : state.snapshot.recipes,
            qaPosts:
              targetType === "community_qa"
                ? state.snapshot.qaPosts.map((post) =>
                    post.id === targetId ? { ...post, viewCount } : post,
                  )
                : state.snapshot.qaPosts,
            reviews:
              targetType === "community_review"
                ? state.snapshot.reviews.map((review) =>
                    review.id === targetId ? { ...review, viewCount } : review,
                  )
                : state.snapshot.reviews,
          }
        : state.snapshot,
    })),
  addQaComment: (postId, comment) =>
    set((state) => ({
      snapshot: state.snapshot
        ? {
            ...state.snapshot,
            qaPosts: state.snapshot.qaPosts.map((post) =>
              post.id === postId
                ? {
                    ...post,
                    commentCount: post.commentCount + 1,
                    comments: [...post.comments, comment],
                  }
                : post,
            ),
          }
        : state.snapshot,
    })),
  addQaReply: (postId, commentId, reply) =>
    set((state) => ({
      snapshot: state.snapshot
        ? {
            ...state.snapshot,
            qaPosts: state.snapshot.qaPosts.map((post) =>
              post.id === postId
                ? {
                    ...post,
                    commentCount: post.commentCount + 1,
                    comments: appendReply(post.comments, commentId, reply),
                  }
                : post,
            ),
          }
        : state.snapshot,
    })),
  updateQaComment: (postId, commentId, body) =>
    set((state) => ({
      snapshot: state.snapshot
        ? {
            ...state.snapshot,
            qaPosts: state.snapshot.qaPosts.map((post) =>
              post.id === postId
                ? {
                    ...post,
                    comments: updateCommentBody(post.comments, commentId, body),
                  }
                : post,
            ),
          }
        : state.snapshot,
    })),
  removeQaComment: (postId, commentId) =>
    set((state) => ({
      snapshot: state.snapshot
        ? {
            ...state.snapshot,
            qaPosts: state.snapshot.qaPosts.map((post) =>
              post.id === postId
                ? {
                    ...post,
                    comments: markCommentDeleted(post.comments, commentId),
                  }
                : post,
            ),
          }
        : state.snapshot,
    })),
  addRecipeComment: (recipeId, comment) =>
    set((state) => ({
      snapshot: state.snapshot
        ? {
            ...state.snapshot,
            recipes: state.snapshot.recipes.map((recipe) =>
              recipe.id === recipeId
                ? {
                    ...recipe,
                    commentCount:
                      (recipe.commentCount ?? recipe.comments?.length ?? 0) + 1,
                    comments: [...(recipe.comments ?? []), comment],
                  }
                : recipe,
            ),
          }
        : state.snapshot,
    })),
  addRecipeReply: (recipeId, commentId, reply) =>
    set((state) => ({
      snapshot: state.snapshot
        ? {
            ...state.snapshot,
            recipes: state.snapshot.recipes.map((recipe) =>
              recipe.id === recipeId
                ? {
                    ...recipe,
                    commentCount:
                      (recipe.commentCount ?? recipe.comments?.length ?? 0) + 1,
                    comments: appendReply(
                      recipe.comments ?? [],
                      commentId,
                      reply,
                    ),
                  }
                : recipe,
            ),
          }
        : state.snapshot,
    })),
  updateRecipeComment: (recipeId, commentId, body) =>
    set((state) => ({
      snapshot: state.snapshot
        ? {
            ...state.snapshot,
            recipes: state.snapshot.recipes.map((recipe) =>
              recipe.id === recipeId
                ? {
                    ...recipe,
                    comments: updateCommentBody(
                      recipe.comments ?? [],
                      commentId,
                      body,
                    ),
                  }
                : recipe,
            ),
          }
        : state.snapshot,
    })),
  removeRecipeComment: (recipeId, commentId) =>
    set((state) => ({
      snapshot: state.snapshot
        ? {
            ...state.snapshot,
            recipes: state.snapshot.recipes.map((recipe) =>
              recipe.id === recipeId
                ? {
                    ...recipe,
                    comments: markCommentDeleted(
                      recipe.comments ?? [],
                      commentId,
                    ),
                  }
                : recipe,
            ),
          }
        : state.snapshot,
    })),
  removeEvent: (eventId) =>
    set((state) => ({
      snapshot: state.snapshot
        ? {
            ...state.snapshot,
            events: state.snapshot.events.filter(
              (event) => event.id !== eventId,
            ),
          }
        : state.snapshot,
    })),
  removeReview: (reviewId) =>
    set((state) => ({
      snapshot: state.snapshot
        ? {
            ...state.snapshot,
            reviews: state.snapshot.reviews.filter(
              (review) => review.id !== reviewId,
            ),
          }
        : state.snapshot,
    })),
  removeRecipe: (recipeId) =>
    set((state) => ({
      snapshot: state.snapshot
        ? {
            ...state.snapshot,
            recipes: state.snapshot.recipes.filter(
              (recipe) => recipe.id !== recipeId,
            ),
          }
        : state.snapshot,
    })),
  removeQaPost: (postId) =>
    set((state) => ({
      snapshot: state.snapshot
        ? {
            ...state.snapshot,
            qaPosts: state.snapshot.qaPosts.filter(
              (post) => post.id !== postId,
            ),
          }
        : state.snapshot,
    })),
  removeBlockedUser: (userId) =>
    set((state) => ({
      snapshot: state.snapshot
        ? {
            ...state.snapshot,
            events: filterBlockedUserItems(state.snapshot.events, userId),
            reviews: filterBlockedUserItems(state.snapshot.reviews, userId),
            recipes: filterBlockedUserItems(state.snapshot.recipes, userId).map(
              (recipe) => {
                const comments = recipe.comments
                  ? filterBlockedUserComments(recipe.comments, userId)
                  : undefined;
                return {
                  ...recipe,
                  comments,
                  commentCount: countComments(comments ?? []),
                };
              },
            ),
            qaPosts: filterBlockedUserItems(state.snapshot.qaPosts, userId).map(
              (post) => {
                const comments = filterBlockedUserComments(
                  post.comments,
                  userId,
                );
                return {
                  ...post,
                  comments,
                  commentCount: countComments(comments),
                };
              },
            ),
          }
        : state.snapshot,
    })),
}));

function appendReply(
  comments: QaComment[],
  commentId: string,
  reply: QaComment,
): QaComment[] {
  return comments.map((comment) =>
    comment.id === commentId
      ? { ...comment, replies: [...(comment.replies ?? []), reply] }
      : {
          ...comment,
          replies: comment.replies
            ? appendReply(comment.replies, commentId, reply)
            : comment.replies,
        },
  );
}

function updateCommentBody(
  comments: QaComment[],
  commentId: string,
  body: string,
): QaComment[] {
  return comments.map((comment) =>
    comment.id === commentId
      ? { ...comment, body }
      : {
          ...comment,
          replies: comment.replies
            ? updateCommentBody(comment.replies, commentId, body)
            : comment.replies,
        },
  );
}

function markCommentDeleted(
  comments: QaComment[],
  commentId: string,
): QaComment[] {
  return comments.map((comment) =>
    comment.id === commentId
      ? {
          ...comment,
          authorName: "댓글 작성자",
          authorAvatarUrl: undefined,
          body: DELETED_COMMENT_BODY,
          isDeleted: true,
          isOwner: false,
        }
      : {
          ...comment,
          replies: comment.replies
            ? markCommentDeleted(comment.replies, commentId)
            : comment.replies,
        },
  );
}
