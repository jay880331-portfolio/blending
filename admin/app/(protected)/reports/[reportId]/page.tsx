import { ReportDetailScreen } from "../../../../src/ui/moderation/ReportDetailScreen";
export default async function ReportPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  return <ReportDetailScreen id={(await params).reportId} />;
}
