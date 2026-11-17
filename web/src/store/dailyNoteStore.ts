"use client";

import { create } from "zustand";
import { fetchDailyNote, fetchDailyNotes } from "@/adapters/http/dailyNoteApi";
import {
  mergeDailyNoteFeed,
  type DailyNote,
  type DailyNoteComment,
  type DailyNoteFeedItem,
} from "@/domain/daily-note/dailyNote";

type DailyNoteStore = {
  feed: DailyNoteFeedItem[];
  nextCursor?: string;
  status: "idle" | "loading" | "ready" | "error";
  loadingMore: boolean;
  error?: string;
  details: Record<string, DailyNote>;
  detailStatus: Record<string, "loading" | "ready" | "error">;
  detailErrors: Record<string, string | undefined>;
  submitting: boolean;
  loadFeed: (reset?: boolean, retry?: boolean) => Promise<void>;
  retryFeed: () => Promise<void>;
  loadDetail: (id: string) => Promise<DailyNote | undefined>;
  prepend: (note: DailyNote) => void;
  replace: (note: DailyNote) => void;
  remove: (id: string) => void;
  setSubmitting: (submitting: boolean) => void;
  updateLike: (id: string, liked: boolean, likeCount: number) => void;
  updateComments: (id: string, comments: DailyNoteComment[]) => void;
};

export const useDailyNoteStore = create<DailyNoteStore>()((set, get) => ({
  feed: [],
  status: "idle",
  loadingMore: false,
  details: {},
  detailStatus: {},
  detailErrors: {},
  submitting: false,
  loadFeed: async (reset = false, retry = false) => {
    const state = get();
    if (state.status === "loading" || state.loadingMore) return;
    if (!reset && state.error && !retry) return;
    if (!reset && state.status === "ready" && !state.nextCursor) return;
    set(
      reset
        ? { status: "loading", error: undefined, nextCursor: undefined }
        : { loadingMore: true, error: undefined },
    );
    try {
      const response = await fetchDailyNotes(
        reset ? undefined : state.nextCursor,
      );
      set((current) => ({
        feed: reset
          ? mergeDailyNoteFeed([], response.items)
          : mergeDailyNoteFeed(current.feed, response.items),
        nextCursor: response.nextCursor,
        status: "ready",
        loadingMore: false,
      }));
    } catch (error) {
      set({
        status: get().feed.length ? "ready" : "error",
        loadingMore: false,
        error:
          error instanceof Error
            ? error.message
            : "STORY를 불러오지 못했습니다.",
      });
    }
  },
  retryFeed: () => get().loadFeed(false, true),
  loadDetail: async (id) => {
    set((state) => ({
      detailStatus: { ...state.detailStatus, [id]: "loading" },
      detailErrors: { ...state.detailErrors, [id]: undefined },
    }));
    try {
      const detail = await fetchDailyNote(id);
      set((state) => ({
        details: { ...state.details, [id]: detail },
        detailStatus: { ...state.detailStatus, [id]: "ready" },
      }));
      return detail;
    } catch (error) {
      set((state) => ({
        detailStatus: { ...state.detailStatus, [id]: "error" },
        detailErrors: {
          ...state.detailErrors,
          [id]:
            error instanceof Error
              ? error.message
              : "STORY를 불러오지 못했습니다.",
        },
      }));
      return undefined;
    }
  },
  prepend: (note) =>
    set((state) => ({
      feed: mergeDailyNoteFeed<DailyNoteFeedItem>([note], state.feed),
      details: { ...state.details, [note.id]: note },
    })),
  replace: (note) =>
    set((state) => ({
      feed: state.feed.map((item) =>
        item.id === note.id
          ? {
              id: note.id,
              imageUrls: note.imageUrls.slice(0, 1),
              technicals: note.technicals,
              featuredTechnicalKeys: note.featuredTechnicalKeys,
              createdAt: note.createdAt,
            }
          : item,
      ),
      details: { ...state.details, [note.id]: note },
    })),
  remove: (id) =>
    set((state) => {
      const details = { ...state.details };
      const detailStatus = { ...state.detailStatus };
      const detailErrors = { ...state.detailErrors };
      delete details[id];
      delete detailStatus[id];
      delete detailErrors[id];
      return {
        feed: state.feed.filter((item) => item.id !== id),
        details,
        detailStatus,
        detailErrors,
      };
    }),
  setSubmitting: (submitting) => set({ submitting }),
  updateLike: (id, liked, likeCount) =>
    set((state) => ({
      details: state.details[id]
        ? { ...state.details, [id]: { ...state.details[id], liked, likeCount } }
        : state.details,
    })),
  updateComments: (id, comments) =>
    set((state) => {
      const detail = state.details[id];
      const commentCount = comments.length;
      return {
        details: detail
          ? { ...state.details, [id]: { ...detail, comments, commentCount } }
          : state.details,
      };
    }),
}));
