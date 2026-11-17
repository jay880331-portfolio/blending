import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthenticatedPage } from "@/infrastructure/server/pageAuth";
import {
  getUserFromSessionToken,
  SESSION_COOKIE,
} from "@/infrastructure/server/auth";
import { canWriteShowroom } from "@/domain/showroom/access";
import { CouponScanApp } from "@/ui/showroom/CouponScanApp";
export default async function CouponScanPage() {
  await requireAuthenticatedPage();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = token ? await getUserFromSessionToken(token) : null;
  if (!canWriteShowroom(user?.role)) redirect("/mypage");
  return <CouponScanApp />;
}
