import { notFound } from "next/navigation";
import { ContentFormScreen } from "../../../../../src/ui/content/ContentFormScreen";
import { isAdminContentKind } from "../../../../../src/ui/content/contentKind";

export default async function NewContentPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  if (!isAdminContentKind(kind)) notFound();
  return <ContentFormScreen kind={kind} />;
}
