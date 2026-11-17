import { AdminSessionGate } from "../../src/ui/auth/AdminSessionGate";
import { AdminShell } from "../../src/ui/shared/AdminShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AdminSessionGate>
      <AdminShell>{children}</AdminShell>
    </AdminSessionGate>
  );
}
