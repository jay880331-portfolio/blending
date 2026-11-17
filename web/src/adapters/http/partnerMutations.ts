"use client";

import axios from "axios";
import { apiMessage } from "@/adapters/http/apiError";
import type {
  PartnerAttachment,
  PartnerCategoryValue,
} from "@/domain/partner/types";
import type { MemberSnapshot } from "@/domain/member/types";

async function currentMemberProfile() {
  try {
    const response = await axios.get<MemberSnapshot>("/api/member");
    return response.data.profile;
  } catch {
    return null;
  }
}

export async function createPartnerPromotion(input: {
  title: string;
  category: PartnerCategoryValue;
  companyName: string;
  productName: string;
  description: string;
  thumbnailUrl?: string;
  imageUrls: string[];
  attachments?: PartnerAttachment[];
  tags: string[];
  externalUrl?: string;
  publishedFrom?: string;
  publishedTo?: string;
}) {
  try {
    const response = await axios.post("/api/partner/promotions", input);
    return response.data as { id: string };
  } catch (error) {
    throw new Error(apiMessage(error, "홍보글 등록에 실패했습니다."));
  }
}

export async function updatePartnerPromotion(
  promotionId: string,
  input: {
    title: string;
    category: PartnerCategoryValue;
    companyName: string;
    productName: string;
    description: string;
    thumbnailUrl?: string;
    imageUrls: string[];
    attachments?: PartnerAttachment[];
    tags: string[];
    externalUrl?: string;
    publishedFrom?: string;
    publishedTo?: string;
  },
) {
  try {
    const response = await axios.patch(
      `/api/partner/promotions/${promotionId}`,
      input,
    );
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "홍보글 수정에 실패했습니다."));
  }
}

export async function createPartnerReview(input: {
  productName: string;
  category: PartnerCategoryValue;
  brand: string;
  modelName: string;
  features?: string;
  body: string;
  imageUrls: string[];
  attachments?: PartnerAttachment[];
  tags: string[];
  majorPros: string[];
  reviewerName?: string;
  summary?: string;
  baristaTip?: string;
  relatedUrl?: string;
}) {
  try {
    const profile = await currentMemberProfile();
    const response = await axios.post("/api/partner/reviews", {
      ...input,
      reviewerName: input.reviewerName ?? profile?.name,
    });
    return response.data as { id: string };
  } catch (error) {
    throw new Error(apiMessage(error, "리뷰 등록에 실패했습니다."));
  }
}

export async function updatePartnerReview(
  reviewId: string,
  input: {
    productName: string;
    category: PartnerCategoryValue;
    brand: string;
    modelName: string;
    features?: string;
    summary?: string;
    body: string;
    imageUrls: string[];
    attachments?: PartnerAttachment[];
    tags: string[];
    majorPros: string[];
    baristaTip?: string;
    relatedUrl?: string;
  },
) {
  try {
    const response = await axios.patch(
      `/api/partner/reviews/${reviewId}`,
      input,
    );
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "리뷰 수정에 실패했습니다."));
  }
}

export async function likePartnerPromotion(
  promotionId: string,
  liked: boolean,
) {
  try {
    const response = await axios.post(
      `/api/partner/promotions/${promotionId}/like`,
      { liked },
    );
    return response.data as { likes: number; liked: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "좋아요 반영에 실패했습니다."));
  }
}

export async function likePartnerReview(reviewId: string, liked: boolean) {
  try {
    const response = await axios.post(`/api/partner/reviews/${reviewId}/like`, {
      liked,
    });
    return response.data as { likes: number; liked: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "좋아요 반영에 실패했습니다."));
  }
}

export async function deletePartnerPromotion(promotionId: string) {
  try {
    const response = await axios.delete(
      `/api/partner/promotions/${promotionId}`,
    );
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "홍보글 삭제에 실패했습니다."));
  }
}

export async function deletePartnerReview(reviewId: string) {
  try {
    const response = await axios.delete(`/api/partner/reviews/${reviewId}`);
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "리뷰 삭제에 실패했습니다."));
  }
}
