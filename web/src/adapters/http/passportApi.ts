import type {
  CoffeePassport,
  PassportFlavor,
  PassportMenu,
} from "@/domain/passport/passport";
import type {
  PassportSummaryData,
  StoreReviewItem,
} from "@/domain/passport/types";

export async function fetchMyPassport(): Promise<CoffeePassport | null> {
  const res = await fetch("/api/member/passport", { cache: "no-store" });
  if (!res.ok) throw new Error("커피 여권을 불러오지 못했습니다.");
  const data = (await res.json()) as { passport: CoffeePassport | null };
  return data.passport;
}

export async function saveMyPassport(payload: {
  flavor: PassportFlavor;
  menus: PassportMenu[];
  decaf: boolean;
}): Promise<CoffeePassport> {
  const res = await fetch("/api/member/passport", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(error.error || "커피 여권을 저장하지 못했습니다.");
  }
  const data = (await res.json()) as { passport: CoffeePassport };
  return data.passport;
}

export async function fetchPassportSummary(): Promise<PassportSummaryData> {
  const res = await fetch("/api/passport/summary", { cache: "no-store" });
  if (!res.ok) throw new Error("여권 요약 정보를 불러오지 못했습니다.");
  return (await res.json()) as PassportSummaryData;
}

export async function fetchStoreReviews(
  storeId: string,
): Promise<{ reviews: StoreReviewItem[]; canWriteReview: boolean }> {
  const res = await fetch(
    `/api/showroom/${encodeURIComponent(storeId)}/reviews`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error("리뷰를 불러오지 못했습니다.");
  return (await res.json()) as {
    reviews: StoreReviewItem[];
    canWriteReview: boolean;
  };
}

export async function createStoreReview(
  storeId: string,
  body: string,
): Promise<{
  id: string;
  storeId: string;
  stampId: string;
  body: string;
  createdAt: string;
  pointsEarned: number;
}> {
  const res = await fetch(
    `/api/showroom/${encodeURIComponent(storeId)}/reviews`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new Error(
      error.message || error.error || "리뷰를 등록하지 못했습니다.",
    );
  }
  const data = (await res.json()) as {
    review: {
      id: string;
      storeId: string;
      stampId: string;
      body: string;
      createdAt: string;
      pointsEarned: number;
    };
  };
  return data.review;
}
