import { requireAuthenticatedPage } from "@/infrastructure/server/pageAuth";
import { StaffApplyApp } from "@/ui/showroom/StaffApplyApp";

export const dynamic = "force-dynamic";

export default async function StaffApplyPage() {
  await requireAuthenticatedPage();
  return <StaffApplyApp />;
}
