export const BUSINESS_VERIFICATION_STATUSES = [
  "PENDING",
  "VERIFIED",
  "REJECTED",
] as const;

export type BusinessVerificationStatus =
  (typeof BUSINESS_VERIFICATION_STATUSES)[number];

export type BusinessVerification = {
  number: string;
  status: BusinessVerificationStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectReason?: string;
};

export const BUSINESS_REJECT_REASON_MAX_LENGTH = 100;

const NTS_WEIGHTS = [1, 3, 7, 1, 3, 7, 1, 3, 5] as const;

export function normalizeBusinessNumber(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(digits)) return null;
  return digits;
}

export function isValidBusinessNumber(raw: string): boolean {
  const digits = normalizeBusinessNumber(raw);
  if (!digits) return false;
  const nums = Array.from(digits, Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += nums[i] * NTS_WEIGHTS[i];
  }
  sum += Math.floor((nums[8] * 5) / 10);
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === nums[9];
}

export function formatBusinessNumber(raw: string): string {
  const digits = normalizeBusinessNumber(raw);
  if (!digits) return raw;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}
