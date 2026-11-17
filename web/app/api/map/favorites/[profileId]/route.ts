import { type NextRequest, NextResponse } from "next/server";
import type { FavoriteProfile, MemberProfile } from "@/domain/member/types";
import { getMongoDb, toDomain } from "@/infrastructure/mongodb/client";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import {
  getCurrentUser,
  type UserDocument,
} from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";

type FavoriteRequest = {
  favorited: boolean;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { profileId } = await params;
  if (profileId === user.id)
    return jsonError("내 프로필은 즐겨찾기할 수 없습니다.");

  const body = await readJson<FavoriteRequest>(request);
  const favorited = body.favorited !== false;
  await ensureMongoIndexes();

  const db = await getMongoDb();
  const profile = await db
    .collection<MemberProfile & { ownerId?: string }>("member_profiles")
    .findOne({ ownerId: profileId });
  const targetUser = await db
    .collection<UserDocument>("users")
    .findOne({ id: profileId });

  if (!profile && !targetUser)
    return jsonError("프로필을 찾을 수 없습니다.", 404);

  const favorite = favoriteFromProfile(profile, targetUser, profileId);
  const favorites = db.collection<
    FavoriteProfile & { ownerId: string; deletedAt?: string }
  >("member_favorites");
  const existingFavorite = await favorites.findOne({
    ownerId: user.id,
    id: profileId,
    deletedAt: { $exists: false },
  });

  if (favorited) {
    await favorites.updateOne(
      { ownerId: user.id, id: profileId },
      {
        $set: { ...favorite, ownerId: user.id },
        $unset: { deletedAt: "" },
      },
      { upsert: true },
    );
  } else {
    await favorites.deleteOne({ ownerId: user.id, id: profileId });
  }

  const delta = favorited
    ? existingFavorite
      ? 0
      : 1
    : existingFavorite
      ? -1
      : 0;
  let favoriteCount = profile?.favoriteCount ?? 0;

  if (delta !== 0) {
    await db.collection("member_profiles").updateOne({ ownerId: profileId }, [
      {
        $set: {
          favoriteCount: {
            $max: [
              0,
              {
                $add: [{ $ifNull: ["$favoriteCount", 0] }, delta],
              },
            ],
          },
        },
      },
    ]);

    const updatedProfile = await db
      .collection<
        Pick<MemberProfile, "favoriteCount"> & { ownerId?: string }
      >("member_profiles")
      .findOne({ ownerId: profileId }, { projection: { favoriteCount: 1 } });
    favoriteCount = updatedProfile?.favoriteCount ?? 0;
  }

  return NextResponse.json({ success: true, favorited, favoriteCount });
}

function favoriteFromProfile(
  profile: (MemberProfile & { ownerId?: string }) | null,
  user: UserDocument | null,
  profileId: string,
): FavoriteProfile {
  const domainProfile = profile ? toDomain(profile) : null;

  return {
    id: profileId,
    name: domainProfile?.name ?? user?.name ?? "이름 없음",
    role: domainProfile?.role ?? user?.role,
    specialties: domainProfile?.specialties ?? user?.specialties ?? [],
    bio: domainProfile?.bio ?? "",
    avatarUrl: domainProfile?.avatarUrl ?? user?.avatarUrl,
    favorited: true,
  };
}
