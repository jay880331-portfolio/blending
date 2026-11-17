export const ADMIN_BUSINESS_VERIFICATION_STATUSES = [
  "PENDING",
  "VERIFIED",
  "REJECTED",
] as const;

export type AdminBusinessVerificationStatus =
  (typeof ADMIN_BUSINESS_VERIFICATION_STATUSES)[number];

export type AdminBusinessVerificationItem = {
  storeId: string;
  storeName: string;
  ownerId: string;
  ownerName: string;
  businessNumber: string;
  status: AdminBusinessVerificationStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectReason?: string;
};

export type AdminBusinessVerificationListResponse = {
  items: AdminBusinessVerificationItem[];
  total: number;
};

export type AdminBusinessVerificationDecisionRequest = {
  decision: "approve" | "reject";
  reason?: string;
  number: string;
  submittedAt?: string;
};
