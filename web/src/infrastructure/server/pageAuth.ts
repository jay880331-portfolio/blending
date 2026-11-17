import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getUserFromSessionToken,
  SESSION_COOKIE,
} from "@/infrastructure/server/auth";

export async function requireAuthenticatedPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token || !(await getUserFromSessionToken(token))) redirect("/login");
}
