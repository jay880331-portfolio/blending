"use client";

import axios from "axios";
import { apiMessage } from "@/adapters/http/apiError";
import type {
  DailyNote,
  DailyNoteComment,
  DailyNoteFeedItem,
  DailyNoteInput,
} from "@/domain/daily-note/dailyNote";

const pendingNoteLikes = new Set<Promise<unknown>>();

export async function waitForPendingDailyNoteLikes() {
  await Promise.allSettled([...pendingNoteLikes]);
}

export type DailyNoteFeedResponse = {
  items: DailyNoteFeedItem[];
  nextCursor?: string;
};

export async function fetchMyDailyNotes(limit = 3, cursor?: string) {
  try {
    const response = await axios.get<DailyNoteFeedResponse>(
      "/api/community/daily-notes",
      {
        params: { limit, mine: "1", ...(cursor ? { cursor } : {}) },
      },
    );
    return response.data;
  } catch (error) {
    throw new Error(apiMessage(error, "STORY를 불러오지 못했습니다."));
  }
}

export async function fetchDailyNotes(cursor?: string) {
  try {
    const response = await axios.get<DailyNoteFeedResponse>(
      "/api/community/daily-notes",
      { params: { limit: 30, ...(cursor ? { cursor } : {}) } },
    );
    return response.data;
  } catch (error) {
    throw new Error(apiMessage(error, "STORY를 불러오지 못했습니다."));
  }
}

export async function fetchPickedDailyNotes(cursor?: string) {
  try {
    return (
      await axios.get<{ items: DailyNote[]; nextCursor?: string }>(
        "/api/community/daily-notes",
        { params: { picked: "1", limit: 6, ...(cursor ? { cursor } : {}) } },
      )
    ).data;
  } catch (error) {
    throw new Error(apiMessage(error, "PICK을 불러오지 못했습니다."));
  }
}

export async function fetchDailyNote(id: string) {
  try {
    return (await axios.get<DailyNote>(`/api/community/daily-notes/${id}`))
      .data;
  } catch (error) {
    throw new Error(apiMessage(error, "STORY를 불러오지 못했습니다."));
  }
}

export async function createDailyNote(input: DailyNoteInput) {
  try {
    return (await axios.post<DailyNote>("/api/community/daily-notes", input))
      .data;
  } catch (error) {
    throw new Error(apiMessage(error, "STORY 등록에 실패했습니다."));
  }
}

export async function updateDailyNote(id: string, input: DailyNoteInput) {
  try {
    return (
      await axios.patch<DailyNote>(`/api/community/daily-notes/${id}`, input)
    ).data;
  } catch (error) {
    throw new Error(apiMessage(error, "STORY 수정에 실패했습니다."));
  }
}

export async function deleteDailyNote(id: string) {
  try {
    await axios.delete(`/api/community/daily-notes/${id}`);
  } catch (error) {
    throw new Error(apiMessage(error, "STORY 삭제에 실패했습니다."));
  }
}

export async function likeDailyNote(id: string, liked: boolean) {
  const request = persistDailyNoteLike(id, liked);
  pendingNoteLikes.add(request);
  try {
    return await request;
  } finally {
    pendingNoteLikes.delete(request);
  }
}

async function persistDailyNoteLike(id: string, liked: boolean) {
  try {
    return (
      await axios.post<{ liked: boolean; likeCount: number }>(
        `/api/community/daily-notes/${id}/like`,
        { liked },
      )
    ).data;
  } catch (error) {
    throw new Error(apiMessage(error, "좋아요 반영에 실패했습니다."));
  }
}

export async function likeDailyNoteComment(
  id: string,
  commentId: string,
  liked: boolean,
) {
  try {
    return (
      await axios.post<{ liked: boolean; likes: number }>(
        `/api/community/daily-notes/${id}/comments/${commentId}/like`,
        { liked },
      )
    ).data;
  } catch (error) {
    throw new Error(apiMessage(error, "좋아요 반영에 실패했습니다."));
  }
}

export async function createDailyNoteComment(id: string, body: string) {
  try {
    return (
      await axios.post<DailyNoteComment>(
        `/api/community/daily-notes/${id}/comments`,
        { body },
      )
    ).data;
  } catch (error) {
    throw new Error(apiMessage(error, "댓글 등록에 실패했습니다."));
  }
}

export async function updateDailyNoteComment(
  id: string,
  commentId: string,
  body: string,
) {
  try {
    return (
      await axios.patch<{ success: boolean }>(
        `/api/community/daily-notes/${id}/comments/${commentId}`,
        { body },
      )
    ).data;
  } catch (error) {
    throw new Error(apiMessage(error, "댓글 수정에 실패했습니다."));
  }
}

export async function deleteDailyNoteComment(id: string, commentId: string) {
  try {
    return (
      await axios.delete<{ success: boolean }>(
        `/api/community/daily-notes/${id}/comments/${commentId}`,
      )
    ).data;
  } catch (error) {
    throw new Error(apiMessage(error, "댓글 삭제에 실패했습니다."));
  }
}
