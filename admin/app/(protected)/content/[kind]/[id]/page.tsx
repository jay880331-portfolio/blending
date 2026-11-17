import { notFound } from "next/navigation";
import { ContentDetailScreen } from "../../../../../src/ui/content/ContentDetailScreen";
import { isAdminContentKind } from "../../../../../src/ui/content/contentKind";

export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  if (!isAdminContentKind(kind)) notFound();
  return <ContentDetailScreen kind={kind} id={id} />;
}
