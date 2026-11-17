import type { CouponUsageScope, UserCouponStatus, UserCoupon } from "./types";

export const APPROVAL_WINDOW_MS = 3 * 60 * 1000;

export function isCouponExpired(validUntil: string, now = new Date()) {
  return new Date(validUntil).getTime() < now.getTime();
}

export function resolveUserCouponStatus(
  status: UserCouponStatus,
  validUntil: string | undefined,
  now = new Date(),
  approvalExpiresAt?: string | null,
): UserCouponStatus {
  if (status === "USED" || status === "EXPIRED") return status;
  if (validUntil && isCouponExpired(validUntil, now)) return "EXPIRED";
  if (status === "REQUESTED") {
    const expiresTime = approvalExpiresAt
      ? new Date(approvalExpiresAt).getTime()
      : NaN;
    if (!Number.isNaN(expiresTime) && expiresTime > now.getTime()) {
      return "REQUESTED";
    }
    return "ISSUED";
  }
  return status;
}

export type CouponUseRequestDecision =
  | { kind: "used" }
  | { kind: "reject" }
  | { kind: "same" }
  | { kind: "request"; approvalExpiresAt: string };

export function decideCouponUseRequest(
  status: UserCouponStatus,
  validUntil: string | undefined,
  approvalExpiresAt: string | null | undefined,
  now: Date,
): CouponUseRequestDecision {
  if (status === "USED") return { kind: "used" };
  if (
    status === "EXPIRED" ||
    (validUntil && isCouponExpired(validUntil, now))
  ) {
    return { kind: "reject" };
  }
  if (
    resolveUserCouponStatus(status, validUntil, now, approvalExpiresAt) ===
    "REQUESTED"
  ) {
    return { kind: "same" };
  }
  return {
    kind: "request",
    approvalExpiresAt: new Date(
      now.getTime() + APPROVAL_WINDOW_MS,
    ).toISOString(),
  };
}

export function isEligibleForNewApprovalWindow(
  status: UserCouponStatus,
  approvalExpiresAt: string | null | undefined,
  now: Date,
): boolean {
  if (status === "ISSUED") return true;
  if (status === "REQUESTED") {
    if (!approvalExpiresAt) return true;
    const expiresTime = new Date(approvalExpiresAt).getTime();
    if (Number.isNaN(expiresTime) || expiresTime <= now.getTime()) {
      return true;
    }
    return false;
  }
  return false;
}

export type CouponApprovalDecision =
  | { kind: "approve"; usedAt: string }
  | { kind: "already_used" }
  | { kind: "conflict" };

export function decideCouponApproval(
  status: UserCouponStatus,
  validUntil: string | undefined,
  approvalExpiresAt: string | null | undefined,
  now: Date,
): CouponApprovalDecision {
  if (status === "USED") {
    return { kind: "already_used" };
  }
  if (
    status === "EXPIRED" ||
    (validUntil && isCouponExpired(validUntil, now))
  ) {
    return { kind: "conflict" };
  }
  if (
    resolveUserCouponStatus(status, validUntil, now, approvalExpiresAt) ===
    "REQUESTED"
  ) {
    return { kind: "approve", usedAt: now.toISOString() };
  }
  return { kind: "conflict" };
}

export type CouponRejectDecision =
  | { kind: "revert" }
  | { kind: "already_issued" }
  | { kind: "conflict" };

export function decideCouponReject(
  status: UserCouponStatus,
  validUntil: string | undefined,
  approvalExpiresAt: string | null | undefined,
  now: Date,
): CouponRejectDecision {
  if (status === "REQUESTED") {
    return { kind: "revert" };
  }
  if (status === "ISSUED") {
    return { kind: "already_issued" };
  }
  return { kind: "conflict" };
}

export function isLiveOwnerCouponRequest(
  status: UserCouponStatus,
  validUntil: string | undefined,
  approvalExpiresAt: string | null | undefined,
  now: Date,
): boolean {
  return (
    status === "REQUESTED" &&
    resolveUserCouponStatus(status, validUntil, now, approvalExpiresAt) ===
      "REQUESTED"
  );
}

export function userCouponListPlacement(
  status: UserCouponStatus,
  validUntil: string | undefined,
  approvalExpiresAt: string | null | undefined,
  now: Date,
): "available" | "history" {
  const derived = resolveUserCouponStatus(
    status,
    validUntil,
    now,
    approvalExpiresAt,
  );
  if (derived === "USED" || derived === "EXPIRED") {
    return "history";
  }
  return "available";
}

export function normalizeCouponUsageScope(value: unknown): CouponUsageScope {
  if (value === "SINGLE" || value === "GROUP" || value === "ALL") return value;
  if (value === "designated" || value === "joined") return value;
  return "own";
}

export function parseCouponUsageScope(value: unknown): CouponUsageScope | null {
  if (value === "SINGLE" || value === "GROUP" || value === "ALL") return value;
  if (value == null || value === "" || value === "own") return "own";
  if (value === "designated" || value === "joined") return value;
  return null;
}

export function couponUsageScopeLabel(value: unknown): string {
  const scope = normalizeCouponUsageScope(value);
  if (scope === "SINGLE") return "한 매장 전용";
  if (scope === "GROUP") return "지정 매장 연합";
  if (scope === "ALL") return "전국 모든 카페";
  if (scope === "designated") return "지정 카페";
  if (scope === "joined") return "가입 카페";
  return "내 카페";
}

export function decideRedemptionShowroom(input: {
  usageScope: CouponUsageScope | undefined;
  issuerShowroomId: string;
  designatedShowroomId?: string | null;
  requestedShowroomId?: string | null;
  joinedShowroomIds: readonly string[];
  storeId?: string;
  allowedStoreIds?: readonly string[];
}): { ok: true; showroomId: string } | { ok: false } {
  const scope = normalizeCouponUsageScope(input.usageScope);
  const requestedStore = input.requestedShowroomId?.trim();
  if (scope === "SINGLE") {
    const id = input.storeId || input.issuerShowroomId;
    return id && (!requestedStore || requestedStore === id)
      ? { ok: true, showroomId: id }
      : { ok: false };
  }
  if (scope === "ALL" || scope === "GROUP") {
    return requestedStore &&
      (scope === "ALL" || input.allowedStoreIds?.includes(requestedStore))
      ? { ok: true, showroomId: requestedStore }
      : { ok: false };
  }
  if (scope === "own") {
    return input.issuerShowroomId
      ? { ok: true, showroomId: input.issuerShowroomId }
      : { ok: false };
  }
  if (scope === "designated") {
    const id = input.designatedShowroomId?.trim();
    return id ? { ok: true, showroomId: id } : { ok: false };
  }
  const requested = input.requestedShowroomId?.trim();
  if (!requested || !input.joinedShowroomIds.includes(requested))
    return { ok: false };
  return { ok: true, showroomId: requested };
}

export function isUserCouponUsable(userCoupon: UserCoupon, now = new Date()) {
  const coupon = userCoupon.couponSnapshot ?? userCoupon.coupon;
  if (
    !coupon ||
    userCoupon.status === "USED" ||
    userCoupon.status === "EXPIRED"
  )
    return false;
  const until = Date.parse(coupon.validUntil);
  const from = coupon.validFrom ? Date.parse(coupon.validFrom) : -Infinity;
  return until > now.getTime() && from <= now.getTime();
}
