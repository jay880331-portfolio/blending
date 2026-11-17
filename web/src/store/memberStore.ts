"use client";

import { create } from "zustand";
import { fetchMemberSnapshot } from "@/adapters/http/memberApi";
import { forgetSessionToken } from "@/adapters/http/sessionPersistence";
import type {
  DirectMessage,
  MemberSnapshot,
  NotificationSettingKey,
  NotificationSettings,
  PublicMemberRole,
  StatusMessage,
} from "@/domain/member/types";

export function isBlockedMessage(message: DirectMessage, userId: string) {
  return message.senderId === userId || message.recipientId === userId;
}

type MemberStore = {
  snapshot?: MemberSnapshot;
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  selectedSignupRole: PublicMemberRole;
  signupPhone: string;
  signupCode: string[];
  signupDevCode?: string;
  signupVerificationToken: string;
  selectedStatus: StatusMessage;
  portfolioPublic: boolean;
  favoriteStates: Record<string, boolean>;
  recipeLikes: Record<string, boolean>;
  load: (options?: { force?: boolean }) => Promise<void>;
  setSelectedSignupRole: (role: PublicMemberRole) => void;
  setSignupPhone: (phone: string) => void;
  setSignupCodeDigit: (index: number, value: string) => void;
  setSignupCode: (code: string[]) => void;
  setSignupDevCode: (code?: string) => void;
  clearSignupCode: () => void;
  setSignupVerificationToken: (token: string) => void;
  setSelectedStatus: (status: StatusMessage) => void;
  setPortfolioPublic: (value: boolean) => void;
  setNotificationSetting: (key: NotificationSettingKey, value: boolean) => void;
  setNotificationSettings: (settings: NotificationSettings) => void;
  markNotificationRead: (notificationId: string) => void;
  markNotificationsReadByHref: (href: string) => void;
  markAllNotificationsRead: () => void;
  removeNotification: (notificationId: string) => void;
  toggleFavorite: (id: string, baseValue: boolean) => void;
  toggleRecipeLike: (id: string, baseValue: boolean) => void;
  removeBlockedUser: (userId: string) => void;
};

export const useMemberStore = create<MemberStore>()((set, get) => ({
  status: "idle",
  selectedSignupRole: "barista",
  signupPhone: "",
  signupCode: ["", "", "", "", "", ""],
  signupDevCode: undefined,
  signupVerificationToken: "",
  selectedStatus: "guest",
  portfolioPublic: true,
  favoriteStates: {},
  recipeLikes: {},
  load: async (options) => {
    if (
      get().status === "loading" ||
      (!options?.force && get().status === "ready")
    )
      return;

    set({ status: "loading", error: undefined });

    try {
      const snapshot = await fetchMemberSnapshot();
      set({
        snapshot,
        status: "ready",
        selectedStatus: snapshot.profile.status,
        portfolioPublic: snapshot.profile.isPortfolioPublic,
      });
      forgetSessionToken();
    } catch (error) {
      set({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "회원 데이터를 불러오지 못했습니다.",
      });
    }
  },
  setSelectedSignupRole: (role) => set({ selectedSignupRole: role }),
  setSignupPhone: (phone) => set({ signupPhone: phone }),
  setSignupCodeDigit: (index, value) =>
    set((state) => {
      const nextCode = [...state.signupCode];
      nextCode[index] = value;
      return { signupCode: nextCode };
    }),
  setSignupCode: (code) => set({ signupCode: code.slice(0, 6) }),
  setSignupDevCode: (code) => set({ signupDevCode: code }),
  clearSignupCode: () => set({ signupCode: ["", "", "", "", "", ""] }),
  setSignupVerificationToken: (token) =>
    set({ signupVerificationToken: token }),
  setSelectedStatus: (status) => set({ selectedStatus: status }),
  setPortfolioPublic: (value) =>
    set((state) =>
      state.snapshot
        ? {
            portfolioPublic: value,
            snapshot: {
              ...state.snapshot,
              profile: {
                ...state.snapshot.profile,
                isPortfolioPublic: value,
              },
            },
          }
        : { portfolioPublic: value },
    ),
  setNotificationSetting: (key, value) =>
    set((state) =>
      state.snapshot
        ? {
            snapshot: {
              ...state.snapshot,
              notificationSettings: {
                ...state.snapshot.notificationSettings,
                [key]: value,
              },
            },
          }
        : {},
    ),
  setNotificationSettings: (settings) =>
    set((state) =>
      state.snapshot
        ? {
            snapshot: {
              ...state.snapshot,
              notificationSettings: settings,
            },
          }
        : {},
    ),
  markNotificationRead: (notificationId) =>
    set((state) =>
      state.snapshot
        ? {
            snapshot: {
              ...state.snapshot,
              notifications: state.snapshot.notifications.map((notification) =>
                notification.id === notificationId
                  ? { ...notification, unread: false }
                  : notification,
              ),
            },
          }
        : {},
    ),
  markNotificationsReadByHref: (href) =>
    set((state) =>
      state.snapshot
        ? {
            snapshot: {
              ...state.snapshot,
              notifications: state.snapshot.notifications.map((notification) =>
                notification.href === href
                  ? { ...notification, unread: false }
                  : notification,
              ),
            },
          }
        : {},
    ),
  markAllNotificationsRead: () =>
    set((state) =>
      state.snapshot
        ? {
            snapshot: {
              ...state.snapshot,
              notifications: state.snapshot.notifications.map(
                (notification) => ({ ...notification, unread: false }),
              ),
            },
          }
        : {},
    ),
  removeNotification: (notificationId) =>
    set((state) =>
      state.snapshot
        ? {
            snapshot: {
              ...state.snapshot,
              notifications: state.snapshot.notifications.filter(
                (notification) => notification.id !== notificationId,
              ),
            },
          }
        : {},
    ),
  toggleFavorite: (id, baseValue) =>
    set((state) => ({
      favoriteStates: {
        ...state.favoriteStates,
        [id]: !(state.favoriteStates[id] ?? baseValue),
      },
    })),
  toggleRecipeLike: (id, baseValue) =>
    set((state) => ({
      recipeLikes: {
        ...state.recipeLikes,
        [id]: !(state.recipeLikes[id] ?? baseValue),
      },
    })),
  removeBlockedUser: (userId) =>
    set((state) => ({
      snapshot: state.snapshot
        ? {
            ...state.snapshot,
            messages: state.snapshot.messages.filter(
              (message) => !isBlockedMessage(message, userId),
            ),
            favorites: state.snapshot.favorites.filter(
              (profile) => profile.id !== userId,
            ),
            favoriteFollowers: state.snapshot.favoriteFollowers.filter(
              (profile) => profile.id !== userId,
            ),
          }
        : state.snapshot,
    })),
}));
