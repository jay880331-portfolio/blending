import axios from "axios";
import { waitForPendingDailyNoteLikes } from "@/adapters/http/dailyNoteApi";
import type { MemberSnapshot } from "@/domain/member/types";

type MessageResponse = {
  message?: string;
};

export async function fetchMemberSnapshot() {
  await waitForPendingDailyNoteLikes();
  try {
    const response = await axios.get<MemberSnapshot>("/api/member", {
      headers: { "Cache-Control": "no-cache" },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError<MessageResponse>(error)) {
      throw new Error(
        error.response?.data?.message ?? "회원 데이터를 불러오지 못했습니다.",
      );
    }
    throw error;
  }
}
