export const STAMP_POINTS = 100;
export const REVIEW_POINTS = 50;
export const POINT_EXPIRY_DAYS = 365;
export const DEFAULT_EXCHANGE_POINTS = 1000;
export const MIN_EXCHANGE_POINTS = 100;
export const MAX_EXCHANGE_POINTS = 10000;
export const EXCHANGE_POINTS_STEP = 100;
export const REVIEW_MIN_LENGTH = 10;
export const REVIEW_MAX_LENGTH = 500;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function toKstDateKey(now = new Date()): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function computePointExpiresAt(createdAt: Date): Date {
  return new Date(
    createdAt.getTime() + POINT_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );
}

export type PointLedgerBalanceEntry = {
  _id?: string;
  id?: string;
  amount: number;
  remaining?: number;
  expiresAt?: string;
  createdAt: string;
};

export function isLedgerEntryActive(
  entry: PointLedgerBalanceEntry,
  now = new Date(),
): boolean {
  if (entry.amount <= 0 || (entry.remaining ?? 0) <= 0) return false;
  if (!entry.expiresAt) return true;
  const expiresMs = Date.parse(entry.expiresAt);
  return Number.isFinite(expiresMs) && expiresMs > now.getTime();
}

export function calculateAvailablePoints(
  entries: PointLedgerBalanceEntry[],
  now = new Date(),
): number {
  let total = 0;
  for (const entry of entries) {
    if (!isLedgerEntryActive(entry, now)) continue;
    total += entry.remaining ?? 0;
  }
  return total;
}

export type PointAllocation = {
  ledgerId: string;
  amount: number;
};

export function allocatePointsFifo(
  entries: PointLedgerBalanceEntry[],
  pointsToRedeem: number,
  now = new Date(),
): { ok: true; allocations: PointAllocation[] } | { ok: false; error: string } {
  if (
    !Number.isInteger(pointsToRedeem) ||
    pointsToRedeem <= 0 ||
    pointsToRedeem % EXCHANGE_POINTS_STEP !== 0
  ) {
    return { ok: false, error: "차감할 포인트 값이 올바르지 않습니다." };
  }

  const eligible = entries
    .filter((entry) => isLedgerEntryActive(entry, now))
    .sort((a, b) => {
      const expA = a.expiresAt ? Date.parse(a.expiresAt) : Infinity;
      const expB = b.expiresAt ? Date.parse(b.expiresAt) : Infinity;
      if (expA !== expB) return expA - expB;
      return Date.parse(a.createdAt) - Date.parse(b.createdAt);
    });

  let needed = pointsToRedeem;
  const allocations: PointAllocation[] = [];

  for (const entry of eligible) {
    if (needed <= 0) break;
    const ledgerId = entry._id ?? entry.id;
    const available = entry.remaining ?? 0;
    if (!ledgerId || available <= 0) continue;

    const take = Math.min(needed, available);
    allocations.push({ ledgerId, amount: take });
    needed -= take;
  }

  if (needed > 0) {
    return { ok: false, error: "포인트 잔액이 부족합니다." };
  }

  return { ok: true, allocations };
}

export function validateReviewBody(
  raw: string,
): { ok: true; body: string } | { ok: false; error: string } {
  const body = raw.trim();
  const length = [...body].length;
  if (length < REVIEW_MIN_LENGTH) {
    return {
      ok: false,
      error: `리뷰는 최소 ${REVIEW_MIN_LENGTH}자 이상 입력해주세요.`,
    };
  }
  if (length > REVIEW_MAX_LENGTH) {
    return {
      ok: false,
      error: `리뷰는 ${REVIEW_MAX_LENGTH}자 이하로 입력해주세요.`,
    };
  }
  return { ok: true, body };
}

export function validateExchangePoints(
  raw: unknown,
): { ok: true; points: number | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, points: null };
  }
  if (
    typeof raw !== "number" ||
    !Number.isInteger(raw) ||
    raw < MIN_EXCHANGE_POINTS ||
    raw > MAX_EXCHANGE_POINTS ||
    raw % EXCHANGE_POINTS_STEP !== 0
  ) {
    return {
      ok: false,
      error: `교환 포인트는 ${MIN_EXCHANGE_POINTS}~${MAX_EXCHANGE_POINTS.toLocaleString("ko-KR")}P 범위의 ${EXCHANGE_POINTS_STEP}P 단위로 입력해주세요.`,
    };
  }
  return { ok: true, points: raw };
}

export const PASSPORT_BUSINESS_VERIFICATION_REQUIRED_MESSAGE =
  "사업자 인증이 완료된 매장만 이용할 수 있습니다.";

/**
 * 5단계 사업자번호 승인 게이트 지점.
 * 사업자번호가 VERIFIED 상태인 쇼룸만 커피 여권/스탬프/원두 예약을 운영할 수 있다.
 */
export function canStoreRunPassport(
  store:
    | {
        id: string;
        businessVerification?: { status?: string } | null;
      }
    | null
    | undefined,
): boolean {
  if (!store?.id) return false;
  return store.businessVerification?.status === "VERIFIED";
}
