import { requireAuthenticatedPage } from "@/infrastructure/server/pageAuth";
import { UserCouponsApp } from "@/ui/showroom/UserCouponsApp";

export default async function UserCouponsPage() {
  await requireAuthenticatedPage();

  return <UserCouponsApp />;
}
