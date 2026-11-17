import type { CoffeePassport, StoreTasteProfile } from "../passport/passport";
import type { BusinessVerification } from "./businessNumber";
import type { ShowroomStatusNotice } from "./statusNotice";

export type CouponType = "regular" | "timesale";

// 소문자 값은 기존 발행 쿠폰의 사용처를 그대로 보존한다.
export type CouponUsageScope =
  | "SINGLE"
  | "GROUP"
  | "ALL"
  | "own"
  | "designated"
  | "joined";

export type UserCouponStatus = "ISSUED" | "USED" | "EXPIRED" | "REQUESTED";

export type ShowroomLocation = {
  latitude: number;
  longitude: number;
  address?: string;
};

export type BaristaShowroom = {
  id: string;
  userId: string;
  storeName: string;
  bioMessage: string;
  platformCouponsAcceptedAt?: string;
  baristaName?: string;
  avatarUrl?: string;
  location?: ShowroomLocation;
  statusNotice?: ShowroomStatusNotice;
  tasteProfile?: StoreTasteProfile;
  businessVerification?: BusinessVerification;
  businessVerified?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ShowroomMenu = {
  id: string;
  baristaId: string;
  showroomId: string;
  name: string;
  price: number;
  tastingNotes: string[];
  imageUrl: string;
  exchangePoints?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ShowroomCoupon = {
  id: string;
  baristaId: string;
  showroomId: string;
  title: string;
  discountDetail: string;
  validUntil: string;
  couponType: CouponType;
  usageScope?: CouponUsageScope;
  designatedShowroomId?: string;
  storeId?: string;
  allowedStoreIds?: string[];
  lastPushedAt?: string;
  policyVersion?: 2;
  benefit?: CouponBenefit;
  validFrom?: string;
  totalLimit?: number;
  perUserLimit?: number;
  issuedCount?: number;
  issuanceStoppedAt?: string;
  conditions?: string;
  allowStacking?: boolean;
  costBearer?: "ISSUER" | "REDEEMING_STORE";
  approvals?: CouponApproval[];
  approvalState?: "PENDING" | "ACTIVE" | "REJECTED";
  createdAt: string;
  updatedAt: string;
};

export type UserCoupon = {
  id: string;
  userId: string;
  couponId: string;
  status: UserCouponStatus;
  usedAt?: string | null;
  approvalExpiresAt?: string | null;
  redemptionShowroomId?: string | null;
  usedAtStoreId?: string;
  usedAtStoreName?: string;
  usageLogId?: string;
  couponSnapshot?: ShowroomCoupon;
  claimRequestId?: string;
  createdAt: string;
  updatedAt: string;
  coupon?: ShowroomCoupon;
  showroom?: BaristaShowroom;
};

export type StoreQr = { storeId: string; code: string };
export type CouponStore = {
  id: string;
  storeName: string;
  acceptsPlatformCoupons?: boolean;
};
export type CouponBenefit = {
  kind: "AMOUNT" | "PERCENT" | "ITEM";
  value?: number;
  itemName?: string;
  minimumOrder?: number;
  maximumDiscount?: number;
};
export type CouponApproval = {
  storeId: string;
  storeName: string;
  ownerId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decidedAt?: string;
  decidedBy?: string;
};
export type CouponUsageLog = {
  id: string;
  userCouponId: string;
  couponId: string;
  userId: string;
  issuerStoreId: string;
  storeId: string;
  storeName: string;
  title: string;
  discountDetail: string;
  usageScope: CouponUsageScope;
  usedAt: string;
  method: "STORE_QR" | "STAFF_QR";
  processedBy?: string;
  costBearer?: "ISSUER" | "REDEEMING_STORE";
  benefit?: CouponBenefit;
};

export type JoinedShowroomOption = {
  id: string;
  storeName: string;
};

export type MemberLastLocation = {
  userId: string;
  location: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  updatedAt: Date;
};

export type ShowroomDetailData = {
  showroom: BaristaShowroom;
  menus: ShowroomMenu[];
  coupons: Array<
    ShowroomCoupon & {
      claimed: boolean;
      claimedCount?: number;
      userCouponId?: string;
    }
  >;
  isOwner: boolean;
  isFavorited?: boolean;
  viewerPassport?: CoffeePassport | null;
};

export type StoreFavoriteItem = {
  storeId: string;
  storeName: string;
  address?: string;
  avatarUrl?: string;
  baristaName?: string;
  hasActiveNotice: boolean;
  hasActiveTimesale: boolean;
  createdAt: string;
};

export type NoticeManageStore = {
  id: string;
  storeName: string;
  isOwner: boolean;
  statusNotice?: ShowroomStatusNotice;
};

export type TimesalePushResult = {
  success: boolean;
  recipientCount: number;
  message: string;
  acceptedCount?: number;
  failedCount?: number;
  suppressedCount?: number;
  runId?: string;
};
