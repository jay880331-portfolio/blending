import { NoticeFormScreen } from "../../../../../src/ui/content/NoticeFormScreen";

export default async function NoticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NoticeFormScreen id={id} />;
}
