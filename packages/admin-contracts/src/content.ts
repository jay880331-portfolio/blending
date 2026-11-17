import type { AdminListQuery, AdminPage } from "./common";

export const ADMIN_CONTENT_KINDS = [
  "community_event",
  "community_review",
  "community_b_talk",
  "community_qa",
  "partner_promotion",
  "partner_review",
  "partner_banner",
] as const;
export type AdminContentKind = (typeof ADMIN_CONTENT_KINDS)[number];

export const ADMIN_CONTENT_STATES = ["active", "hidden", "deleted"] as const;
export type AdminContentState = (typeof ADMIN_CONTENT_STATES)[number];

export const ADMIN_CONTENT_SORTS = [
  "createdAt",
  "updatedAt",
  "views",
  "likes",
  "title",
] as const;
export type AdminContentSort = (typeof ADMIN_CONTENT_SORTS)[number];

export type AdminContentListQuery = AdminListQuery & {
  kind: AdminContentKind;
  authorId?: string;
  state?: AdminContentState;
  sort?: AdminContentSort;
};

type OwnedContentInput = { ownerId: string };

export type AdminContentAttachment = {
  url: string;
  name: string;
  size: number;
  contentType: string;
};

export type EventCategory = "official" | "seminar" | "meetup";

export type AdminCommunityEventInput = {
  kind: "community_event";
  title: string;
  category: EventCategory;
  startsAt: string;
  endsAt?: string | null;
  location: string;
  address: string;
  imageUrl: string;
  posterUrl: string;
  description: string;
  applyUrl?: string | null;
};

export type AdminCommunityReviewInput = OwnedContentInput & {
  kind: "community_review";
  eventId: string;
  title: string;
  category: EventCategory;
  authorName: string;
  authorHandle?: string | null;
  authorAvatarUrl?: string | null;
  body: string;
  imageUrls: string[];
  keywords: string[];
};

export type AdminCommunityBTalkInput = OwnedContentInput & {
  kind: "community_b_talk";
  title: string;
  roast: "light" | "medium" | "dark";
  authorName: string;
  authorHandle?: string | null;
  authorAvatarUrl?: string | null;
  coverUrl?: string | null;
  processImages: string[];
  bean: { origin: string; process: string; roastPoint: string };
  extraction: { dosing: string; yield: string; time: string; temp: string };
  note: string;
};

export type AdminCommunityQaInput = OwnedContentInput & {
  kind: "community_qa";
  title: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  body: string;
  imageUrls: string[];
};

export type AdminPartnerPromotionInput = OwnedContentInput & {
  kind: "partner_promotion";
  title: string;
  category:
    | "espresso-machine"
    | "grinder"
    | "ice-equipment"
    | "brewing-roaster"
    | "ingredient"
    | "supplies";
  companyName: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  summary: string;
  description: string;
  thumbnailUrl: string;
  imageUrls: string[];
  attachments?: AdminContentAttachment[] | null;
  brochureUrls: string[];
  tags: string[];
  externalUrl?: string | null;
  specs: { companyName: string; productName: string; categoryLabel: string };
};

export type AdminPartnerReviewInput = OwnedContentInput & {
  kind: "partner_review";
  promotionId: string;
  productName: string;
  category: AdminPartnerPromotionInput["category"];
  brand: string;
  modelName: string;
  features: string;
  reviewerName: string;
  reviewerAvatarUrl?: string | null;
  reviewerResumeUrl?: string | null;
  summary: string;
  body: string;
  imageUrls: string[];
  attachments?: AdminContentAttachment[] | null;
  tags: string[];
  majorPros: string[];
  baristaTip: string;
  relatedUrl?: string | null;
};

export type AdminPartnerBannerInput = {
  kind: "partner_banner";
  title: string;
  subtitle: string;
  imageUrl: string;
  href: string;
  sortOrder: number;
  activeFrom: string;
  activeTo: string;
};

export const EVENT_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;
export type EventRequestStatus = (typeof EVENT_REQUEST_STATUSES)[number];

export type AdminEventRequestDto = {
  id: string;
  requesterId: string;
  title: string;
  body: string;
  category?: EventCategory;
  applyUrl?: string;
  location?: string;
  address?: string;
  imageUrl?: string;
  schedule?: string;
  time?: string;
  status: EventRequestStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionReason?: string;
  eventId?: string;
};

export type AdminEventRequestListQuery = AdminListQuery & {
  status?: EventRequestStatus;
};
export type AdminEventRequestPage = AdminPage<AdminEventRequestDto>;

export type DecideEventRequestInput =
  | { decision: "reject"; reason: string }
  | {
      decision: "approve";
      reason: string;
      event: Omit<
        AdminCommunityEventInput,
        "kind" | "imageUrl" | "posterUrl"
      > & {
        imageUrl?: string;
        posterUrl?: string;
      };
    };

export type AdminContentInput =
  | AdminCommunityEventInput
  | AdminCommunityReviewInput
  | AdminCommunityBTalkInput
  | AdminCommunityQaInput
  | AdminPartnerPromotionInput
  | AdminPartnerReviewInput
  | AdminPartnerBannerInput;

export type AdminContentDto = {
  id: string;
  kind: AdminContentKind;
  state: AdminContentState;
  ownerId?: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  moderationReason?: string;
  views: number;
  likes: number;
  searchVisible: boolean;
  data: AdminContentInput;
};

export type AdminContentPage = AdminPage<AdminContentDto>;

export type AdminContentStateInput = { reason: string };
export type AdminContentWriteInput = {
  content: AdminContentInput;
  reason?: string;
};

export type AdminContentReactionDeleteInput = {
  reactionId: string;
  reason: string;
};

export type AdminContentReactionDto = {
  id: string;
  userId?: string;
  anonymous: boolean;
  createdAt: string;
};
