import { Suspense } from "react";
import { AuditLogListScreen } from "../../../src/ui/audit/AuditLogListScreen";
export default function AuditLogsPage() {
  return (
    <Suspense fallback={<p>불러오는 중…</p>}>
      <AuditLogListScreen />
    </Suspense>
  );
}
