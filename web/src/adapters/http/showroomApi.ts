import type { CouponDraft } from "@/domain/showroom/couponPolicy";
import type {
  ShowroomNoticeExpiryOption,
  ShowroomStatusNotice,
} from "@/domain/showroom/statusNotice";
import type {
  BaristaShowroom,
  JoinedShowroomOption,
  NoticeManageStore,
  ShowroomCoupon,
  ShowroomDetailData,
  ShowroomMenu,
  StoreFavoriteItem,
  TimesalePushResult,
  UserCoupon,
} from "@/domain/showroom/types";

export type UserCouponWallet = {
  userCoupons: UserCoupon[];
  joinedShowrooms: JoinedShowroomOption[];
};

export async function fetchShowrooms(
  sort: "latest" | "popular" = "latest",
): Promise<BaristaShowroom[]> {
  const res = await fetch(`/api/showroom?sort=${sort}`, { cache: "no-store" });
  if (!res.ok) throw new Error("쇼룸 목록을 불러오지 못했습니다.");
  const data = (await res.json()) as { showrooms: BaristaShowroom[] };
  return data.showrooms;
}

export async function fetchShowroomDetail(
  id: string,
): Promise<ShowroomDetailData> {
  const res = await fetch(`/api/showroom/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("쇼룸 정보를 불러오지 못했습니다.");
  return (await res.json()) as ShowroomDetailData;
}

export async function fetchMyShowroom(): Promise<{
  showroom: BaristaShowroom | null;
  menus: ShowroomMenu[];
  coupons: ShowroomCoupon[];
  noticeStores?: NoticeManageStore[];
}> {
  const res = await fetch("/api/showroom/mine", { cache: "no-store" });
  if (!res.ok) throw new Error("내 쇼룸 정보를 불러오지 못했습니다.");
  return (await res.json()) as {
    showroom: BaristaShowroom | null;
    menus: ShowroomMenu[];
    coupons: ShowroomCoupon[];
    noticeStores?: NoticeManageStore[];
  };
}

export async function saveShowroom(payload: {
  storeName: string;
  bioMessage: string;
  location?: { latitude: number; longitude: number; address?: string };
  tasteProfile?: BaristaShowroom["tasteProfile"];
}): Promise<BaristaShowroom> {
  const res = await fetch("/api/showroom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(error.error || "쇼룸 저장에 실패했습니다.");
  }
  const data = (await res.json()) as { showroom: BaristaShowroom };
  return data.showroom;
}

export async function addMenu(payload: {
  name: string;
  price: number;
  tastingNotes: string[];
  imageUrl: string;
  exchangePoints?: number | null;
}): Promise<ShowroomMenu> {
  const res = await fetch("/api/showroom/menus", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(error.error || "메뉴 등록에 실패했습니다.");
  }
  const data = (await res.json()) as { menu: ShowroomMenu };
  return data.menu;
}

export async function updateMenuExchangePoints(
  menuId: string,
  exchangePoints: number | null,
): Promise<ShowroomMenu> {
  const res = await fetch(`/api/showroom/menus/${encodeURIComponent(menuId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exchangePoints }),
  });
  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(error.error || "교환 포인트 설정에 실패했습니다.");
  }
  const data = (await res.json()) as { menu: ShowroomMenu };
  return data.menu;
}

export async function removeMenu(menuId: string): Promise<void> {
  const res = await fetch(`/api/showroom/menus/${encodeURIComponent(menuId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("메뉴 삭제에 실패했습니다.");
}

export async function addCoupon(payload: CouponDraft): Promise<ShowroomCoupon> {
  const res = await fetch("/api/showroom/coupons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      (error as { message?: string }).message || "쿠폰 등록에 실패했습니다.",
    );
  }
  const data = (await res.json()) as { coupon: ShowroomCoupon };
  return data.coupon;
}

export async function removeCoupon(couponId: string): Promise<void> {
  const res = await fetch(
    `/api/showroom/coupons/${encodeURIComponent(couponId)}`,
    {
      method: "DELETE",
    },
  );
  if (!res.ok) throw new Error("쿠폰 삭제에 실패했습니다.");
}

export async function claimShowroomCoupon(
  couponId: string,
  requestId?: string,
): Promise<UserCoupon> {
  const res = await fetch(
    `/api/showroom/coupons/${encodeURIComponent(couponId)}/claim`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    },
  );
  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(error.message || "쿠폰 담기에 실패했습니다.");
  }
  const data = (await res.json()) as { userCoupon: UserCoupon };
  return data.userCoupon;
}

export async function triggerTimesalePush(
  couponId: string,
  customTitle?: string,
  customBody?: string,
): Promise<TimesalePushResult> {
  const res = await fetch(
    `/api/showroom/coupons/${encodeURIComponent(couponId)}/timesale-push`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customTitle, customBody }),
    },
  );
  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(error.error || "타임세일 푸시 발송에 실패했습니다.");
  }
  return (await res.json()) as TimesalePushResult;
}

export async function fetchUserCoupons(): Promise<UserCouponWallet> {
  const res = await fetch("/api/showroom/user-coupons", { cache: "no-store" });
  if (!res.ok) throw new Error("쿠폰함을 불러오지 못했습니다.");
  const data = (await res.json()) as {
    userCoupons: UserCoupon[];
    joinedShowrooms?: JoinedShowroomOption[];
  };
  return {
    userCoupons: data.userCoupons,
    joinedShowrooms: data.joinedShowrooms ?? [],
  };
}

export async function readCouponResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { message?: string };
  if (!response.ok)
    throw new Error(data.message || "처리하지 못했습니다. 다시 시도해 주세요.");
  return data;
}

export async function updateLastLocation(
  latitude: number,
  longitude: number,
): Promise<void> {
  await fetch("/api/member/last-location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude, longitude }),
  });
}

export class ShowroomApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ShowroomApiError";
    this.status = status;
  }
}

export async function fetchCouponUseRequests(): Promise<
  { userCouponId: string; couponTitle: string; memberName: string }[]
> {
  const res = await fetch("/api/showroom/coupon-requests", {
    cache: "no-store",
  });
  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ShowroomApiError(
      error.error || "쿠폰 요청 목록을 불러오지 못했습니다.",
      res.status,
    );
  }
  const data = (await res.json()) as {
    requests: {
      userCouponId: string;
      couponTitle: string;
      memberName: string;
    }[];
  };
  return data.requests;
}

export async function approveCouponUseRequest(
  userCouponId: string,
): Promise<UserCoupon> {
  const res = await fetch(
    `/api/showroom/user-coupons/${encodeURIComponent(userCouponId)}/approve`,
    {
      method: "POST",
    },
  );
  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ShowroomApiError(
      error.error || "쿠폰 승인에 실패했습니다.",
      res.status,
    );
  }
  const data = (await res.json()) as { userCoupon: UserCoupon };
  return data.userCoupon;
}

export async function rejectCouponUseRequest(
  userCouponId: string,
): Promise<UserCoupon> {
  const res = await fetch(
    `/api/showroom/user-coupons/${encodeURIComponent(userCouponId)}/reject`,
    {
      method: "POST",
    },
  );
  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ShowroomApiError(
      error.error || "쿠폰 거절에 실패했습니다.",
      res.status,
    );
  }
  const data = (await res.json()) as { userCoupon: UserCoupon };
  return data.userCoupon;
}

export type CouponPushAudience = "regulars" | "nearby" | "both";
export type CouponPushRun = {
  id: string;
  status: string;
  targetCount: number;
  acceptedCount: number;
  failedCount: number;
  suppressedCount: number;
  createdAt: string;
  receiptAcceptedCount: number | null;
  receiptFailedCount: number | null;
  receiptPendingCount: number | null;
};
export async function fetchCouponApprovals() {
  return readCouponResponse<{
    requests: ShowroomCoupon[];
    isAdmin: boolean;
    reviewerId: string;
  }>(await fetch("/api/showroom/coupon-approvals", { cache: "no-store" }));
}
export async function decideCouponApproval(
  couponId: string,
  storeId: string,
  accept: boolean,
) {
  return readCouponResponse<{ coupon: ShowroomCoupon }>(
    await fetch("/api/showroom/coupon-approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decide", couponId, storeId, accept }),
    }),
  );
}
export async function joinPlatformCoupons() {
  return readCouponResponse<{ success: boolean }>(
    await fetch("/api/showroom/coupon-approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join-network", accept: true }),
    }),
  );
}
export async function previewCouponPush(
  couponId: string,
  customTitle: string,
  customBody: string,
  audience: CouponPushAudience,
) {
  return readCouponResponse<{ recipientCount: number }>(
    await fetch(
      `/api/showroom/coupons/${encodeURIComponent(couponId)}/timesale-push`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customTitle,
          customBody,
          audience,
          preview: true,
        }),
      },
    ),
  );
}
export async function sendCouponPush(
  couponId: string,
  customTitle: string,
  customBody: string,
  audience: CouponPushAudience,
) {
  return readCouponResponse<TimesalePushResult>(
    await fetch(
      `/api/showroom/coupons/${encodeURIComponent(couponId)}/timesale-push`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customTitle, customBody, audience }),
      },
    ),
  );
}
export async function fetchCouponPushRun(couponId: string) {
  return readCouponResponse<{ run: CouponPushRun | null }>(
    await fetch(
      `/api/showroom/coupons/${encodeURIComponent(couponId)}/timesale-push`,
      { cache: "no-store" },
    ),
  );
}

export async function toggleStoreFavorite(
  storeId: string,
  favorited: boolean,
): Promise<{ favorited: boolean; storeId: string }> {
  const res = await fetch(
    `/api/showroom/${encodeURIComponent(storeId)}/favorite`,
    {
      method: favorited ? "PUT" : "DELETE",
    },
  );
  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(error.error || "매장 찜 상태를 변경하지 못했습니다.");
  }
  return (await res.json()) as { favorited: boolean; storeId: string };
}

export async function fetchStoreFavorites(): Promise<StoreFavoriteItem[]> {
  const res = await fetch("/api/showroom/favorites", { cache: "no-store" });
  if (!res.ok) throw new Error("찜한 카페 목록을 불러오지 못했습니다.");
  const data = (await res.json()) as { favorites: StoreFavoriteItem[] };
  return data.favorites;
}

export async function saveShowroomNotice(
  storeId: string,
  text: string,
  expiryOption: ShowroomNoticeExpiryOption,
): Promise<ShowroomStatusNotice> {
  const res = await fetch(
    `/api/showroom/${encodeURIComponent(storeId)}/notice`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, expiryOption }),
    },
  );
  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(error.error || "한줄공지를 저장하지 못했습니다.");
  }
  const data = (await res.json()) as { statusNotice: ShowroomStatusNotice };
  return data.statusNotice;
}

export async function deleteShowroomNotice(storeId: string): Promise<void> {
  const res = await fetch(
    `/api/showroom/${encodeURIComponent(storeId)}/notice`,
    {
      method: "DELETE",
    },
  );
  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(error.error || "한줄공지를 삭제하지 못했습니다.");
  }
}
