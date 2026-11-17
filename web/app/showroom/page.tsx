import { cookies } from "next/headers";
import { requireAuthenticatedPage } from "@/infrastructure/server/pageAuth";
import { getUserFromSessionToken, SESSION_COOKIE } from "@/infrastructure/server/auth";
import { ShowroomListApp } from "@/ui/showroom/ShowroomListApp";

export default async function ShowroomPage() {
  await requireAuthenticatedPage();

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const user = token ? await getUserFromSessionToken(token) : null;

  return <ShowroomListApp userRole={user?.role} />;
}
