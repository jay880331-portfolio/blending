"use client";

import axios from "axios";

type MessageResponse = {
  message?: string;
};

export function apiMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<MessageResponse>(error))
    return error.response?.data?.message ?? fallback;
  return error instanceof Error ? error.message : fallback;
}
