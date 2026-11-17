export type PartnerTab = "promotions" | "reviews";

export type PartnerCategory =
  | "all"
  | "espresso-machine"
  | "grinder"
  | "ice-equipment"
  | "brewing-roaster"
  | "ingredient"
  | "supplies";

export type PartnerCategoryValue = Exclude<PartnerCategory, "all">;

export type PartnerAuthor = {
  name: string;
  avatarUrl?: string;
  resumeUrl?: string;
};

export type PartnerAttachment = {
  url: string;
  name: string;
  size: number;
  contentType: string;
};

export type PartnerPromotion = {
  id: string;
  authorId?: string;
  title: string;
  category: PartnerCategoryValue;
  companyName: string;
  authorName: string;
  authorAvatarUrl?: string;
  createdAt: string;
  summary: string;
  description: string;
  thumbnailUrl: string;
  imageUrls: string[];
  attachments?: PartnerAttachment[];
  brochureUrls: string[];
  tags: string[];
  externalUrl?: string;
  likes: number;
  liked: boolean;
  viewCount: number;
  isOwner?: boolean;
  publishedFrom?: string;
  publishedTo?: string;
  specs: {
    companyName: string;
    productName: string;
    categoryLabel: string;
  };
};

export type PartnerReview = {
  id: string;
  authorId?: string;
  promotionId: string;
  productName: string;
  category: PartnerCategoryValue;
  brand: string;
  modelName: string;
  features: string;
  createdAt: string;
  reviewer: PartnerAuthor;
  summary: string;
  body: string;
  imageUrls: string[];
  attachments?: PartnerAttachment[];
  tags: string[];
  majorPros: string[];
  baristaTip: string;
  relatedUrl?: string;
  likes: number;
  liked: boolean;
  viewCount: number;
  isOwner?: boolean;
};

export type PartnerBanner = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  href: string;
  sortOrder: number;
  activeFrom: string;
  activeTo: string;
};

export type PartnerSnapshot = {
  banners: PartnerBanner[];
  promotions: PartnerPromotion[];
  reviews: PartnerReview[];
  isAdmin?: boolean;
};

export type PartnerRepository = {
  getSnapshot: () => Promise<PartnerSnapshot>;
};
