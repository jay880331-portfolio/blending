import { AuditLogDetailScreen } from "../../../../src/ui/audit/AuditLogDetailScreen";
export default async function AuditLogPage({
  params,
}: {
  params: Promise<{ auditId: string }>;
}) {
  return <AuditLogDetailScreen id={(await params).auditId} />;
}
