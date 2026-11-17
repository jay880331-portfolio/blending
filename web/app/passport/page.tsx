import { cookies } from "next/headers";
import type { MemberProfile } from "@/domain/member/types";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import {
  getUserFromSessionToken,
  SESSION_COOKIE,
} from "@/infrastructure/server/auth";
import { requireAuthenticatedPage } from "@/infrastructure/server/pageAuth";
import { PassportApp } from "@/ui/passport/PassportApp";

export default async function PassportPage() {
  await requireAuthenticatedPage();

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const user = token ? await getUserFromSessionToken(token) : null;

  let initialPassport = null;
  if (user) {
    const db = await getMongoDb();
    const profile = await db
      .collection<MemberProfile & { ownerId?: string }>("member_profiles")
      .findOne({ ownerId: user.id }, { projection: { passport: 1 } });
    initialPassport = profile?.passport ?? null;
  }

  return <PassportApp initialPassport={initialPassport} />;
}
