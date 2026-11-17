import { requireAuthenticatedPage } from "@/infrastructure/server/pageAuth";
import { ShowroomDetailApp } from "@/ui/showroom/ShowroomDetailApp";

type ShowroomDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ShowroomDetailPage({
  params,
}: ShowroomDetailPageProps) {
  await requireAuthenticatedPage();

  const { id } = await params;
  return <ShowroomDetailApp showroomId={id} />;
}
