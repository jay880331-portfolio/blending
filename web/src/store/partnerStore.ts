"use client";

import { create } from "zustand";
import type { ContentViewTargetType } from "@/adapters/http/contentViews";
import { fetchPartnerSnapshot } from "@/adapters/http/partnerApi";
import type { PartnerCategory, PartnerSnapshot } from "@/domain/partner/types";
import { filterBlockedUserItems } from "@/ui/shared/blockedUserEvent";

type PartnerStore = {
  snapshot?: PartnerSnapshot;
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  activeCategory: PartnerCategory;
  searchQuery: string;
  promotionLikes: Record<string, { liked: boolean; likes: number }>;
  reviewLikes: Record<string, { liked: boolean; likes: number }>;
  load: (options?: { force?: boolean }) => Promise<void>;
  setActiveCategory: (category: PartnerCategory) => void;
  setSearchQuery: (query: string) => void;
  togglePromotionLike: (
    promotionId: string,
    baseLikes: number,
    baseLiked: boolean,
  ) => void;
  toggleReviewLike: (
    reviewId: string,
    baseLikes: number,
    baseLiked: boolean,
  ) => void;
  setContentViewCount: (
    targetType: Extract<
      ContentViewTargetType,
      "partner_promotion" | "partner_review"
    >,
    targetId: string,
    viewCount: number,
  ) => void;
  removePromotion: (promotionId: string) => void;
  removeReview: (reviewId: string) => void;
  removeBlockedUser: (userId: string) => void;
};

export const usePartnerStore = create<PartnerStore>()((set, get) => ({
  status: "idle",
  activeCategory: "all",
  searchQuery: "",
  promotionLikes: {},
  reviewLikes: {},
  load: async (options) => {
    if (
      get().status === "loading" ||
      (!options?.force && get().status === "ready")
    )
      return;

    set({ status: "loading", error: undefined });

    try {
      const snapshot = await fetchPartnerSnapshot();
      set({ snapshot, status: "ready" });
    } catch (error) {
      set({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "파트너 데이터를 불러오지 못했습니다.",
      });
    }
  },
  setActiveCategory: (category) => set({ activeCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  togglePromotionLike: (promotionId, baseLikes, baseLiked) =>
    set((state) => {
      const current = state.promotionLikes[promotionId] ?? {
        liked: baseLiked,
        likes: baseLikes,
      };
      const liked = !current.liked;
      return {
        promotionLikes: {
          ...state.promotionLikes,
          [promotionId]: {
            liked,
            likes: current.likes + (liked ? 1 : -1),
          },
        },
      };
    }),
  toggleReviewLike: (reviewId, baseLikes, baseLiked) =>
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
            promotions:
              targetType === "partner_promotion"
                ? state.snapshot.promotions.map((promotion) =>
                    promotion.id === targetId
                      ? { ...promotion, viewCount }
                      : promotion,
                  )
                : state.snapshot.promotions,
            reviews:
              targetType === "partner_review"
                ? state.snapshot.reviews.map((review) =>
                    review.id === targetId ? { ...review, viewCount } : review,
                  )
                : state.snapshot.reviews,
          }
        : state.snapshot,
    })),
  removePromotion: (promotionId) =>
    set((state) => ({
      snapshot: state.snapshot
        ? {
            ...state.snapshot,
            promotions: state.snapshot.promotions.filter(
              (promotion) => promotion.id !== promotionId,
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
  removeBlockedUser: (userId) =>
    set((state) => ({
      snapshot: state.snapshot
        ? {
            ...state.snapshot,
            promotions: filterBlockedUserItems(
              state.snapshot.promotions,
              userId,
            ),
            reviews: filterBlockedUserItems(state.snapshot.reviews, userId),
          }
        : state.snapshot,
    })),
}));
