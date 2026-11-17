import type {
  FaqInput,
  GuideContentDto,
  NoticeInput,
} from "@blending/admin-contracts";

export type PublicNotice = Pick<GuideContentDto, "id" | "publishedAt"> &
  Pick<NoticeInput, "title" | "body">;
export type PublicFaq = Pick<GuideContentDto, "id"> &
  Pick<FaqInput, "category" | "question" | "answer" | "sortOrder">;

async function get<T>(path: string, message: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(message);
  return (await response.json()) as T;
}

export async function fetchPublicNotices(): Promise<PublicNotice[]> {
  const items = await get<GuideContentDto[]>(
    "/api/content/notices",
    "공지사항을 불러오지 못했습니다.",
  );
  return items.map(({ id, publishedAt, data }) => ({
    id,
    publishedAt,
    title: (data as NoticeInput).title,
    body: (data as NoticeInput).body,
  }));
}

export async function fetchPublicFaqs(): Promise<PublicFaq[]> {
  const items = await get<GuideContentDto[]>(
    "/api/content/faqs",
    "FAQ를 불러오지 못했습니다.",
  );
  return items.map(({ id, data }) => ({ id, ...(data as FaqInput) }));
}
