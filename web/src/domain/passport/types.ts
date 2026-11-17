export type PassportPresentationPurpose = "STAMP" | "REDEEM";

export type PassportScanConfirmResult =
  | {
      newlyProcessed: boolean;
      purpose: "STAMP";
      stampId: string;
      storeId: string;
      storeName: string;
      points: number;
      kstDate: string;
      createdAt: string;
    }
  | {
      newlyProcessed: boolean;
      purpose: "REDEEM";
      redeemId: string;
      storeId: string;
      storeName: string;
      menuId: string;
      menuName: string;
      points: number;
      createdAt: string;
    };

export type PassportSummaryData = {
  balance: number;
  totalStamps: number;
  stampedStores: Array<{
    storeId: string;
    storeName: string;
    stampCount: number;
    latestKstDate: string;
    businessVerified?: boolean;
    exchangeableMenus: Array<{
      id: string;
      name: string;
      exchangePoints: number;
    }>;
  }>;
  recentLedger: Array<{
    id: string;
    type: "STAMP" | "REVIEW" | "REDEEM";
    amount: number;
    remaining?: number;
    storeId: string;
    storeName: string;
    createdAt: string;
    expiresAt?: string;
  }>;
};

export type StoreReviewItem = {
  id: string;
  userId: string;
  authorName: string;
  authorAvatarUrl?: string;
  body: string;
  createdAt: string;
};
