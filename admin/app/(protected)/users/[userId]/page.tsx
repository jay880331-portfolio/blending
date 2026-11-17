import { Suspense } from "react";
import { UserDetailScreen } from "../../../../src/ui/users/UserDetailScreen";

export default async function UserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  return (
    <Suspense fallback={<p>불러오는 중…</p>}>
      <UserDetailScreen userId={(await params).userId} />
    </Suspense>
  );
}
