import { redirect } from "next/navigation";
import { requireAuthenticatedPage } from "@/infrastructure/server/pageAuth";

type ChatPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ChatPage({ searchParams }: ChatPageProps) {
  await requireAuthenticatedPage();

  const params = await searchParams;
  const recipientId = stringParam(params.recipientId);
  const targetParams = new URLSearchParams();

  if (recipientId) targetParams.set("thread", recipientId);
  copyParam(params, targetParams, "recipientName");
  copyParam(params, targetParams, "recipientWorkplace");
  copyParam(params, targetParams, "recipientAvatarUrl");

  redirect(
    targetParams.size > 0
      ? `/mypage/messages?${targetParams.toString()}`
      : "/mypage/messages",
  );
}

function copyParam(
  params: Record<string, string | string[] | undefined>,
  targetParams: URLSearchParams,
  key: "recipientName" | "recipientWorkplace" | "recipientAvatarUrl",
) {
  const value = stringParam(params[key]);
  if (value) targetParams.set(key, value);
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
