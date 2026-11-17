"use client";

import axios, { type AxiosInstance } from "axios";
import type { SearchDocumentType, SearchResult } from "@/domain/search/types";

const apiClient: AxiosInstance = axios.create({
  baseURL: "/api",
  timeout: 8000,
});

export type SearchResponse = {
  query: string;
  results: SearchResult[];
};

export async function fetchSearchResults({
  query,
  types,
  signal,
}: {
  query: string;
  types?: SearchDocumentType[];
  signal?: AbortSignal;
}): Promise<SearchResponse> {
  const { data } = await apiClient.get<SearchResponse>("/search", {
    params: {
      q: query,
      type: types?.join(",") ?? "all",
    },
    signal,
  });

  return data;
}
