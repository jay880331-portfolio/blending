"use client";

import axios, { type AxiosInstance } from "axios";
import type { PartnerSnapshot } from "@/domain/partner/types";

const apiClient: AxiosInstance = axios.create({
  baseURL: "/api",
  timeout: 8000,
});

export async function fetchPartnerSnapshot(): Promise<PartnerSnapshot> {
  const { data } = await apiClient.get<PartnerSnapshot>("/partner", {
    headers: { "Cache-Control": "no-cache" },
  });
  return data;
}
