import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthenticatedPage } from "@/infrastructure/server/pageAuth";
import { getUserFromSessionToken, SESSION_COOKIE } from "@/infrastructure/server/auth";
import { canWriteShowroom } from "@/domain/showroom/timesale";
import { ShowroomManageApp } from "@/ui/showroom/ShowroomManageApp";

export default async function ShowroomManagePage() {
  await requireAuthenticatedPage();

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const user = token ? await getUserFromSessionToken(token) : null;

  if (!canWriteShowroom(user?.role)) {
    redirect("/mypage");
  }

  return (
    <ShowroomManageApp workplaces={user?.workplaceLocations ?? []} />
  );
}
