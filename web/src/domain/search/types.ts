export type SearchDocumentType =
  | "community_event"
  | "community_review"
  | "community_b_talk"
  | "community_qa"
  | "partner_promotion"
  | "partner_review"
  | "member_profile";

export type SearchDocumentVisibility = "public" | "private";

export type SearchDocument = {
  id: string;
  sourceType: SearchDocumentType;
  sourceId: string;
  title: string;
  body: string;
  keywords: string[];
  category: string;
  authorName?: string;
  imageUrl?: string;
  href: string;
  visibility: SearchDocumentVisibility;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
};

export type SearchResult = {
  id: string;
  type: SearchDocumentType;
  label: string;
  title: string;
  excerpt: string;
  imageUrl?: string;
  href: string;
  score: number;
};
