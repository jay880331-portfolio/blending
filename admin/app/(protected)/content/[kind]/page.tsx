import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ContentListScreen } from "../../../../src/ui/content/ContentListScreen";
import { isAdminContentKind } from "../../../../src/ui/content/contentKind";

export default async function ContentPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  if (!isAdminContentKind(kind)) notFound();
  return (
    <Suspense fallback={<p>불러오는 중…</p>}>
      <ContentListScreen kind={kind} />
    </Suspense>
  );
}
