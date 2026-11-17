import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getUserFromSessionToken,
  SESSION_COOKIE,
} from "@/infrastructure/server/auth";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  redirect(
    token && (await getUserFromSessionToken(token)) ? "/home" : "/login",
  );
}
