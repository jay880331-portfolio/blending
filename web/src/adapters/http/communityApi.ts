"use client";

import axios, { type AxiosInstance } from "axios";
import type { CommunitySnapshot } from "@/domain/community/types";

const apiClient: AxiosInstance = axios.create({
  baseURL: "/api",
  timeout: 8000,
});

export async function fetchCommunitySnapshot(): Promise<CommunitySnapshot> {
  const { data } = await apiClient.get<CommunitySnapshot>("/community", {
    headers: { "Cache-Control": "no-cache" },
  });
  return data;
}
