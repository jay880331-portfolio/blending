import type { TalkAudience } from "./talkAudience";

export type CommunityTab =
  | "talk-enthusiast"
  | "talk-barista"
  | "calendar"
  | "recipe"
  | "qa";

export type EventCategory = "official" | "seminar" | "meetup";

export type RoastCategory = "light" | "medium" | "dark";

export type CategoryFilter = EventCategory | "all";

export type Author = {
  name: string;
  handle: string;
  avatarUrl?: string;
};

export type CommunityEvent = {
  id: string;
  authorId?: string;
  title: string;
  category: EventCategory;
  startsAt: string;
  endsAt?: string;
  allDay?: boolean;
  location: string;
  address: string;
  imageUrl: string;
  posterUrl: string;
  description: string;
  applyUrl?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentContentType?: string;
  isOwner?: boolean;
  canManage?: boolean;
};

export type EventReview = {
  id: string;
  authorId?: string;
  eventId: string;
  title: string;
  category: EventCategory;
  author: Author;
  createdAt: string;
  imageUrls: string[];
  keywords: string[];
  likes: number;
  viewCount?: number;
  liked?: boolean;
  body: string;
  isOwner?: boolean;
  canManage?: boolean;
};

export type Recipe = {
  id: string;
  authorId?: string;
  audience?: TalkAudience;
  title: string;
  roast: RoastCategory;
  author: Author;
  createdAt?: string;
  likes: number;
  liked: boolean;
  viewCount: number;
  isOwner?: boolean;
  canManage?: boolean;
  coverUrl?: string;
  processImages: string[];
  bean: {
    origin: string;
    process: string;
    roastPoint: string;
  };
  extraction: {
    dosing: string;
    yield: string;
    time: string;
    temp: string;
  };
  note: string;
  commentCount?: number;
  comments?: QaComment[];
};

export type QaComment = {
  id: string;
  authorId?: string;
  authorName: string;
  authorAvatarUrl?: string;
  createdAgo: string;
  createdAt?: string;
  body: string;
  likes: number;
  liked?: boolean;
  isOwner?: boolean;
  canManage?: boolean;
  isDeleted?: boolean;
  isWithdrawnAuthor?: boolean;
  replies?: QaComment[];
};

export type QaPost = {
  id: string;
  authorId?: string;
  title: string;
  authorName: string;
  authorAvatarUrl?: string;
  createdAgo: string;
  createdAt: string;
  commentCount: number;
  imageUrl?: string;
  imageUrls?: string[];
  body: string;
  likes: number;
  liked?: boolean;
  viewCount: number;
  isBarista?: boolean;
  authorRole?: string;
  isOwner?: boolean;
  canManage?: boolean;
  comments: QaComment[];
};

export type CommunitySnapshot = {
  viewerRole?: string;
  events: CommunityEvent[];
  reviews: EventReview[];
  recipes: Recipe[];
  qaPosts: QaPost[];
};

export type CommunityRepository = {
  getSnapshot: () => Promise<CommunitySnapshot>;
};
