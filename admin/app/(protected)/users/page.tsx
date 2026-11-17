import { Suspense } from "react";
import { UserListScreen } from "../../../src/ui/users/UserListScreen";

export default function UsersPage() {
  return (
    <Suspense fallback={<p>불러오는 중…</p>}>
      <UserListScreen />
    </Suspense>
  );
}
