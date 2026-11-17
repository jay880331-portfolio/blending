import { notFound } from "next/navigation";
import { ContentFormScreen } from "../../../../../../src/ui/content/ContentFormScreen";
import { isAdminContentKind } from "../../../../../../src/ui/content/contentKind";

export default async function EditContentPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  if (!isAdminContentKind(kind)) notFound();
  return <ContentFormScreen kind={kind} id={id} />;
}
