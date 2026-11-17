import { Suspense } from "react";
import { ReportListScreen } from "../../../src/ui/moderation/ReportListScreen";
export default function ReportsPage() {
  return (
    <Suspense fallback={<p>불러오는 중…</p>}>
      <ReportListScreen />
    </Suspense>
  );
}
