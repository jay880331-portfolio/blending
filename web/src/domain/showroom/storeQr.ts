import type { ShowroomCoupon, StoreQr } from "./types";

export function storeQrUrl(origin: string, qr: StoreQr): string {
  const url = new URL("/showroom/coupons", origin);
  url.searchParams.set("store", qr.storeId);
  url.searchParams.set("code", qr.code);
  return url.toString();
}

export function isStoreQr(value: unknown): value is StoreQr {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.storeId === "string" &&
    /^[\w-]{1,100}$/.test(candidate.storeId) &&
    typeof candidate.code === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(candidate.code)
  );
}

export function parseStoreQr(value: string, origin: string): StoreQr | null {
  try {
    const url = new URL(value, origin);
    if (
      url.origin !== new URL(origin).origin ||
      url.pathname !== "/showroom/coupons"
    )
      return null;
    const qr = {
      storeId: url.searchParams.get("store"),
      code: url.searchParams.get("code"),
    };
    return isStoreQr(qr) ? qr : null;
  } catch {
    return null;
  }
}

// 서버와 화면이 동일한 사용처 정책을 사용한다. 알 수 없는 정책은 거절한다.
export function couponAllowsStore(
  coupon: ShowroomCoupon,
  storeId: string,
  joinedStoreIds: readonly string[] = [],
  acceptsPlatformCoupons = false,
): boolean {
  if (coupon.policyVersion === 2 && coupon.approvalState !== "ACTIVE")
    return false;
  switch (coupon.usageScope) {
    case "ALL":
      return coupon.policyVersion !== 2 || acceptsPlatformCoupons;
    case "GROUP":
      return coupon.allowedStoreIds?.includes(storeId) ?? false;
    case "SINGLE":
      return (coupon.storeId || coupon.showroomId) === storeId;
    case "designated":
      return coupon.designatedShowroomId === storeId;
    case "joined":
      return joinedStoreIds.includes(storeId);
    case "own":
    case undefined:
      return coupon.showroomId === storeId;
    default:
      return false;
  }
}
