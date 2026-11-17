"use client";

import axios from "axios";
import { apiMessage } from "@/adapters/http/apiError";
import { forgetSessionToken } from "@/adapters/http/sessionPersistence";
import type {
  BaristaProfileDetails,
  CareerItem,
  NotificationSettings,
  SocialLinks,
  StatusMessage,
  WorkplaceLocation,
} from "@/domain/member/types";

export async function updateMemberProfile(input: {
  name: string;
  handle: string;
  avatarUrl?: string;
  status: StatusMessage;
  workplaces?: string[];
  workplaceLocations?: WorkplaceLocation[];
  specialties: string[];
  bio: string;
  activityRegion?: string;
  certificateName?: string;
  baristaProfile?: BaristaProfileDetails;
  socials: SocialLinks;
}) {
  try {
    const response = await axios.patch("/api/member/profile", input);
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "프로필 저장에 실패했습니다."));
  }
}

export async function updateMemberCareers(items: CareerItem[]) {
  try {
    const response = await axios.put("/api/member/careers", { items });
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "이력 저장에 실패했습니다."));
  }
}

export async function createPortfolio(input: {
  title: string;
  summary: string;
  imageUrls: string[];
}) {
  try {
    const response = await axios.post("/api/member/portfolio", input);
    return response.data as { id: string };
  } catch (error) {
    throw new Error(apiMessage(error, "포트폴리오 등록에 실패했습니다."));
  }
}

export async function updatePortfolio(
  portfolioId: string,
  input: {
    title: string;
    summary: string;
    imageUrls: string[];
  },
) {
  try {
    const response = await axios.patch(
      `/api/member/portfolio/${portfolioId}`,
      input,
    );
    return response.data as { id: string };
  } catch (error) {
    throw new Error(apiMessage(error, "포트폴리오 수정에 실패했습니다."));
  }
}

export async function deletePortfolio(portfolioId: string) {
  try {
    const response = await axios.delete(`/api/member/portfolio/${portfolioId}`);
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "포트폴리오 삭제에 실패했습니다."));
  }
}

export async function updatePortfolioVisibility(isPortfolioPublic: boolean) {
  try {
    const response = await axios.patch("/api/member/profile", {
      isPortfolioPublic,
    });
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(
      apiMessage(error, "포트폴리오 공개 설정 저장에 실패했습니다."),
    );
  }
}

export async function updateNotificationSettings(
  input: Partial<NotificationSettings>,
) {
  try {
    const response = await axios.patch(
      "/api/member/notification-settings",
      input,
    );
    return response.data as {
      success: boolean;
      settings: NotificationSettings;
    };
  } catch (error) {
    throw new Error(apiMessage(error, "알림 설정 저장에 실패했습니다."));
  }
}

export async function registerPushToken(input: {
  token: string;
  platform: "android" | "ios" | "web" | "unknown";
}) {
  try {
    const response = await axios.post("/api/member/push-tokens", input);
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "푸시 알림 등록에 실패했습니다."));
  }
}

export async function deleteMemberNotification(notificationId: string) {
  try {
    const response = await axios.delete(
      `/api/member/notifications/${encodeURIComponent(notificationId)}`,
    );
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "알림 삭제에 실패했습니다."));
  }
}

export async function markMemberNotificationRead(notificationId: string) {
  try {
    const response = await axios.patch(
      `/api/member/notifications/${encodeURIComponent(notificationId)}`,
    );
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "알림 읽음 처리에 실패했습니다."));
  }
}

export async function markMemberNotificationsRead(input?: { href?: string }) {
  try {
    const response = await axios.patch("/api/member/notifications", input);
    return response.data as { success: boolean; modifiedCount: number };
  } catch (error) {
    throw new Error(apiMessage(error, "알림 읽음 처리에 실패했습니다."));
  }
}

export async function updateMemberAccountEmail(email: string) {
  try {
    const response = await axios.patch("/api/member/account", { email });
    return response.data as { success: boolean; email: string };
  } catch (error) {
    throw new Error(apiMessage(error, "이메일 등록에 실패했습니다."));
  }
}

export async function updateMemberAccountPhone(input: {
  phone: string;
  phoneVerificationToken: string;
}) {
  try {
    const response = await axios.patch("/api/member/account", input);
    return response.data as { success: boolean; phone: string };
  } catch (error) {
    throw new Error(apiMessage(error, "휴대폰 번호 등록에 실패했습니다."));
  }
}

export async function deleteMemberAccount(input: {
  reason: string;
  feedback?: string;
}): Promise<{ success: boolean }> {
  try {
    const response = await axios.delete("/api/member/account", {
      data: input,
    });
    forgetSessionToken();
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "회원 탈퇴에 실패했습니다."));
  }
}

export async function updateFavoriteProfile(
  profileId: string,
  favorited: boolean,
) {
  try {
    const response = await axios.post(
      `/api/map/favorites/${encodeURIComponent(profileId)}`,
      { favorited },
    );
    return response.data as {
      success: boolean;
      favorited: boolean;
      favoriteCount?: number;
    };
  } catch (error) {
    throw new Error(apiMessage(error, "즐겨찾기를 저장하지 못했습니다."));
  }
}

export async function sendMemberMessage(input: {
  recipientId: string;
  body: string;
  imageUrls?: string[];
}) {
  try {
    const response = await axios.post("/api/member/messages", input);
    return response.data as { success: boolean; id: string };
  } catch (error) {
    throw new Error(apiMessage(error, "대화를 보내지 못했습니다."));
  }
}

export async function markMemberMessagesRead(counterpartId: string) {
  try {
    const response = await axios.patch("/api/member/messages", {
      counterpartId,
    });
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "대화 읽음 처리에 실패했습니다."));
  }
}

export async function updateMemberChatRoomSetting(
  counterpartId: string,
  input: {
    blocked?: boolean;
    muted?: boolean;
  },
) {
  try {
    const response = await axios.patch(
      `/api/member/chat-rooms/${encodeURIComponent(counterpartId)}`,
      input,
    );
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "채팅방 설정 저장에 실패했습니다."));
  }
}

export async function leaveMemberChatRoom(counterpartId: string) {
  try {
    const response = await axios.delete(
      `/api/member/chat-rooms/${encodeURIComponent(counterpartId)}`,
    );
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "채팅방 나가기에 실패했습니다."));
  }
}

export async function recordHomeLastSeen() {
  try {
    await axios.post("/api/member/last-seen");
  } catch {
    // last-seen is best-effort and must not break home.
  }
}
