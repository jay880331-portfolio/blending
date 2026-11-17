import { type NextRequest, NextResponse } from "next/server";
import type { MemberProfile } from "@/domain/member/types";
import {
  parsePassportInput,
  type CoffeePassport,
} from "@/domain/passport/passport";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { profileFromUser } from "@/infrastructure/mongodb/memberMongoRepository";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { nowIso } from "@/infrastructure/server/content";
import { jsonError, readJson } from "@/infrastructure/server/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const db = await getMongoDb();
  const profile = await db
    .collection<MemberProfile & { ownerId?: string }>("member_profiles")
    .findOne({ ownerId: user.id }, { projection: { passport: 1 } });

  return NextResponse.json(
    { passport: profile?.passport ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const body = await readJson<Record<string, unknown>>(request);
  const parsed = parsePassportInput(body);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  const db = await getMongoDb();
  const profiles = db.collection<MemberProfile & { ownerId?: string }>(
    "member_profiles",
  );
  const existing = await profiles.findOne(
    { ownerId: user.id },
    { projection: { passport: 1 } },
  );

  const passport: CoffeePassport = {
    ...parsed.value,
    issuedAt: existing?.passport?.issuedAt ?? nowIso(),
  };

  const insertDefaults = { ...profileFromUser(user) } as MemberProfile & {
    ownerId?: string;
  };
  delete insertDefaults.passport;

  await profiles.updateOne(
    { ownerId: user.id },
    {
      $set: { passport },
      $setOnInsert: insertDefaults,
    },
    { upsert: true },
  );

  return NextResponse.json({ passport });
}
