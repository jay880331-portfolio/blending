import type { AdminListQuery, AdminPage } from "./common";

export const GUIDE_CONTENT_KINDS = ["notice", "faq", "policy"] as const;
export type GuideContentKind = (typeof GUIDE_CONTENT_KINDS)[number];
export type PublishStatus = "draft" | "published";

export type NoticeInput = {
  title: string;
  body: string;
  status: PublishStatus;
  publishedAt?: string;
};
export type FaqInput = {
  category: "guide" | "account";
  question: string;
  answer: string;
  sortOrder: number;
  status: PublishStatus;
  publishedAt?: string;
};
export type PolicyInput = {
  slug: string;
  title: string;
  body: string;
  version: number;
  effectiveAt: string;
  status: PublishStatus;
  publishedAt?: string;
};
export type GuideContentInput = NoticeInput | FaqInput | PolicyInput;
export type GuideContentDto = {
  id: string;
  kind: GuideContentKind;
  status: PublishStatus;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  createdBy: string;
  updatedBy: string;
  data: GuideContentInput;
};
export type GuideContentListQuery = AdminListQuery & {
  status?: PublishStatus;
  deleted?: boolean;
};
export type GuideContentPage = AdminPage<GuideContentDto>;
export type GuideContentWriteInput = {
  content: GuideContentInput;
  reason?: string;
};
