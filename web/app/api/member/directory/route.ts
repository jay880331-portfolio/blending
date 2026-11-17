import type { MemberProfile } from "@/domain/member/types";
import { getMongoDb, toDomain } from "@/infrastructure/mongodb/client";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import {
  getCurrentUser,
  type UserDocument,
} from "@/infrastructure/server/auth";
import { jsonError } from "@/infrastructure/server/http";
import { UserBlockMongoRepository } from "@/infrastructure/mongodb/userBlockMongoRepository";
import { profileBadgeMongoRepository } from "@/infrastructure/mongodb/profileBadgeMongoRepository";
import type { NextRequest } from "next/server";
import { directoryProfileFromUser, directoryUserFilter } from "./directory";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await ensureMongoIndexes();

  const currentUser = await getCurrentUser(request);
  if (!currentUser) return jsonError("로그인이 필요합니다.", 401);

  const [db, blockedOwnerIds] = await Promise.all([
    getMongoDb(),
    new UserBlockMongoRepository().blockedUserIds(currentUser.id),
  ]);
  const users = await db
    .collection<UserDocument>("users")
    .find({
      ...directoryUserFilter(),
      ...(blockedOwnerIds.length ? { id: { $nin: blockedOwnerIds } } : {}),
    })
    .toArray();
  const profileIds = users.map((user) => user.id);
  const profiles = await db
    .collection<MemberProfile & { ownerId?: string }>("member_profiles")
    .find({ ownerId: { $in: profileIds } }, { projection: { passport: 0 } })
    .toArray();
  const profileByOwnerId = new Map(
    profiles.flatMap((profile) =>
      profile.ownerId ? [[profile.ownerId, toDomain(profile)] as const] : [],
    ),
  );
  const primaryBadges =
    await profileBadgeMongoRepository.listPrimaryForOwners(profileIds);

  return Response.json(
    {
      profiles: users.map((user) =>
        directoryProfileFromUser(
          user,
          profileByOwnerId.get(user.id),
          primaryBadges.get(user.id)?.name,
        ),
      ),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
