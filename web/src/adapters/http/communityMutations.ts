"use client";

import axios from "axios";
import { apiMessage } from "@/adapters/http/apiError";
import type {
  EventCategory,
  QaComment,
  RoastCategory,
} from "@/domain/community/types";
import type { MemberSnapshot } from "@/domain/member/types";

async function currentMemberProfile() {
  try {
    const response = await axios.get<MemberSnapshot>("/api/member");
    return response.data.profile;
  } catch {
    return null;
  }
}

export async function createEventRequest(input: {
  title: string;
  category: EventCategory;
  body: string;
  imageUrl?: string;
  schedule?: string;
  time?: string;
  location?: string;
  address?: string;
  applyUrl?: string;
}) {
  try {
    const response = await axios.post("/api/community/event-requests", input);
    return response.data as { id: string };
  } catch (error) {
    throw new Error(apiMessage(error, "일정 요청에 실패했습니다."));
  }
}

export async function createCommunityEvent(input: {
  title: string;
  category: EventCategory;
  description: string;
  startsAt?: string;
  endsAt?: string;
  allDay?: boolean;
  location?: string;
  address?: string;
  imageUrl?: string;
  posterUrl?: string;
  applyUrl?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentContentType?: string;
}) {
  try {
    const response = await axios.post("/api/community/events", input);
    return response.data as { id: string };
  } catch (error) {
    throw new Error(apiMessage(error, "일정 등록에 실패했습니다."));
  }
}

export async function updateCommunityEvent(
  eventId: string,
  input: {
    title: string;
    category: EventCategory;
    description: string;
    startsAt: string;
    endsAt: string;
    allDay: boolean;
    location: string;
    address: string;
    imageUrl?: string;
    posterUrl?: string;
    applyUrl?: string;
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentContentType?: string;
  },
) {
  try {
    const response = await axios.patch(
      `/api/community/events/${eventId}`,
      input,
    );
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "일정 수정에 실패했습니다."));
  }
}

export async function deleteCommunityEvent(eventId: string) {
  try {
    const response = await axios.delete(`/api/community/events/${eventId}`);
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "일정 삭제에 실패했습니다."));
  }
}

export async function createEventReview(input: {
  title: string;
  body: string;
  category: EventCategory;
  imageUrls: string[];
  keywords: string[];
}) {
  try {
    const profile = await currentMemberProfile();
    const response = await axios.post("/api/community/reviews", {
      ...input,
      authorName: profile?.name,
      authorHandle: profile?.handle,
    });
    return response.data as { id: string };
  } catch (error) {
    throw new Error(apiMessage(error, "후기 등록에 실패했습니다."));
  }
}

export async function updateEventReview(
  reviewId: string,
  input: {
    title: string;
    body: string;
    category: EventCategory;
    imageUrls: string[];
    keywords: string[];
  },
) {
  try {
    const response = await axios.patch(
      `/api/community/reviews/${reviewId}`,
      input,
    );
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "후기 수정에 실패했습니다."));
  }
}

export async function likeEventReview(reviewId: string, liked: boolean) {
  try {
    const response = await axios.post(
      `/api/community/reviews/${reviewId}/like`,
      { liked },
    );
    return response.data as { likes: number; liked: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "좋아요 반영에 실패했습니다."));
  }
}

export async function createRecipe(input: {
  title: string;
  roast: RoastCategory;
  note: string;
  coverUrl?: string;
  processImages: string[];
  authorName?: string;
  authorHandle?: string;
  origin?: string;
  process?: string;
  roastPoint?: string;
  dosing?: string;
  yield?: string;
  time?: string;
  temp?: string;
}) {
  try {
    const profile = await currentMemberProfile();
    const response = await axios.post("/api/community/b-talk", {
      ...input,
      authorName: input.authorName ?? profile?.name,
      authorHandle: input.authorHandle ?? profile?.handle,
    });
    return response.data as { id: string };
  } catch (error) {
    throw new Error(apiMessage(error, "B-TALK 글 등록에 실패했습니다."));
  }
}

export async function updateRecipe(
  recipeId: string,
  input: {
    title: string;
    roast: RoastCategory;
    note: string;
    coverUrl?: string;
    processImages: string[];
    origin?: string;
    process?: string;
    roastPoint?: string;
    dosing?: string;
    yield?: string;
    time?: string;
    temp?: string;
  },
) {
  try {
    const response = await axios.patch(
      `/api/community/b-talk/${recipeId}`,
      input,
    );
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "B-TALK 글 수정에 실패했습니다."));
  }
}

export async function createRecipeComment(recipeId: string, body: string) {
  try {
    const profile = await currentMemberProfile();
    const response = await axios.post(
      `/api/community/b-talk/${recipeId}/comments`,
      {
        body,
        authorName: profile?.name,
      },
    );
    return response.data as QaComment;
  } catch (error) {
    throw new Error(apiMessage(error, "댓글 등록에 실패했습니다."));
  }
}

export async function createRecipeReply(
  recipeId: string,
  commentId: string,
  body: string,
) {
  try {
    const profile = await currentMemberProfile();
    const response = await axios.post(
      `/api/community/b-talk/${recipeId}/comments/${commentId}/replies`,
      {
        body,
        authorName: profile?.name,
      },
    );
    return response.data as QaComment;
  } catch (error) {
    throw new Error(apiMessage(error, "답글 등록에 실패했습니다."));
  }
}

export async function updateRecipeComment(
  recipeId: string,
  commentId: string,
  body: string,
) {
  try {
    const response = await axios.patch(
      `/api/community/b-talk/${recipeId}/comments/${commentId}`,
      { body },
    );
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "댓글 수정에 실패했습니다."));
  }
}

export async function deleteRecipeComment(recipeId: string, commentId: string) {
  try {
    const response = await axios.delete(
      `/api/community/b-talk/${recipeId}/comments/${commentId}`,
    );
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "댓글 삭제에 실패했습니다."));
  }
}

export async function createQaPost(input: {
  title: string;
  body: string;
  imageUrl?: string;
  imageUrls?: string[];
}) {
  try {
    const profile = await currentMemberProfile();
    const response = await axios.post("/api/community/qa", {
      ...input,
      authorName: profile?.name,
    });
    return response.data as { id: string };
  } catch (error) {
    throw new Error(apiMessage(error, "질문 등록에 실패했습니다."));
  }
}

export async function updateQaPost(
  postId: string,
  input: {
    title: string;
    body: string;
    imageUrl?: string;
    imageUrls?: string[];
  },
) {
  try {
    const response = await axios.patch(`/api/community/qa/${postId}`, input);
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "질문 수정에 실패했습니다."));
  }
}

export async function createQaComment(postId: string, body: string) {
  try {
    const profile = await currentMemberProfile();
    const response = await axios.post(`/api/community/qa/${postId}/comments`, {
      body,
      authorName: profile?.name,
    });
    return response.data as QaComment;
  } catch (error) {
    throw new Error(apiMessage(error, "댓글 등록에 실패했습니다."));
  }
}

export async function createQaReply(
  postId: string,
  commentId: string,
  body: string,
) {
  try {
    const profile = await currentMemberProfile();
    const response = await axios.post(
      `/api/community/qa/${postId}/comments/${commentId}/replies`,
      {
        body,
        authorName: profile?.name,
      },
    );
    return response.data as QaComment;
  } catch (error) {
    throw new Error(apiMessage(error, "답글 등록에 실패했습니다."));
  }
}

export async function updateQaComment(
  postId: string,
  commentId: string,
  body: string,
) {
  try {
    const response = await axios.patch(
      `/api/community/qa/${postId}/comments/${commentId}`,
      { body },
    );
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "댓글 수정에 실패했습니다."));
  }
}

export async function deleteQaComment(postId: string, commentId: string) {
  try {
    const response = await axios.delete(
      `/api/community/qa/${postId}/comments/${commentId}`,
    );
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "댓글 삭제에 실패했습니다."));
  }
}

export async function deleteQaPost(postId: string) {
  try {
    const response = await axios.delete(`/api/community/qa/${postId}`);
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "질문 삭제에 실패했습니다."));
  }
}

export async function deleteEventReview(reviewId: string) {
  try {
    const response = await axios.delete(`/api/community/reviews/${reviewId}`);
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "후기 삭제에 실패했습니다."));
  }
}

export async function deleteRecipe(recipeId: string) {
  try {
    const response = await axios.delete(`/api/community/b-talk/${recipeId}`);
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "B-TALK 글 삭제에 실패했습니다."));
  }
}

export async function likeRecipe(recipeId: string, liked: boolean) {
  try {
    const response = await axios.post(
      `/api/community/b-talk/${recipeId}/like`,
      {
        liked,
      },
    );
    return response.data as { likes: number; liked: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "좋아요 반영에 실패했습니다."));
  }
}

export async function likeQaPost(postId: string, liked: boolean) {
  try {
    const response = await axios.post(`/api/community/qa/${postId}/like`, {
      liked,
    });
    return response.data as { likes: number; liked: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "좋아요 반영에 실패했습니다."));
  }
}

export async function likeRecipeComment(
  recipeId: string,
  commentId: string,
  liked: boolean,
) {
  try {
    const response = await axios.post(
      `/api/community/b-talk/${recipeId}/comments/${commentId}/like`,
      { liked },
    );
    return response.data as { likes: number; liked: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "좋아요 반영에 실패했습니다."));
  }
}

export async function likeQaComment(
  postId: string,
  commentId: string,
  liked: boolean,
) {
  try {
    const response = await axios.post(
      `/api/community/qa/${postId}/comments/${commentId}/like`,
      { liked },
    );
    return response.data as { likes: number; liked: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "좋아요 반영에 실패했습니다."));
  }
}
