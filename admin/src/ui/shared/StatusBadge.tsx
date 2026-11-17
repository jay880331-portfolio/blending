import { adminStatusLabel } from "../../domain/displayLabels";

export function StatusBadge({ status }: { status: string }) {
  return <span data-status={status}>{adminStatusLabel(status)}</span>;
}
