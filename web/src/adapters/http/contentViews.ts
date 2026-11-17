"use client";

import axios from "axios";

export type ContentViewTargetType =
  | "community_b_talk"
  | "community_qa"
  | "community_review"
  | "partner_promotion"
  | "partner_review";

export async function trackContentView(
  targetType: ContentViewTargetType,
  targetId: string,
) {
  const key = `${targetType}:${targetId}`;
  const existing = pendingContentViews.get(key);
  if (existing) return existing;

  const request = axios
    .post<{ viewCount: number }>("/api/content-views", {
      targetType,
      targetId,
    })
    .then((response) => response.data)
    .finally(() => pendingContentViews.delete(key));

  pendingContentViews.set(key, request);
  return request;
}

const pendingContentViews = new Map<string, Promise<{ viewCount: number }>>();
