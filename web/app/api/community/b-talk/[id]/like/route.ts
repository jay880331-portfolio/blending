import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/infrastructure/server/http";
import {
  setLikeIdentityCookie,
  updateContentLike,
} from "@/infrastructure/server/contentLikes";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { publicContentFilter } from "@/infrastructure/mongodb/adminContentMongoRepository";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { requireContentWriteAllowed } from "@/infrastructure/server/sanctions";
import { scheduleMemberActivityNotification } from "@/infrastructure/server/memberActivityNotifications";

type Params = Promise<{ id: string }>;
type LikeRequest = { liked: boolean };
type LikeTargetPost = { id: string; ownerId?: string; title?: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Params },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  try {
    await requireContentWriteAllowed(user.id);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "작성할 수 없습니다.",
      403,
    );
  }
  const { id } = await params;
  const body = await readJson<LikeRequest>(request);
  const liked = typeof body.liked === "boolean" ? body.liked : true;
  const result = await updateContentLike(request, {
    collectionName: "community_b_talk",
    targetType: "community_b_talk",
    targetId: id,
    liked,
  });
  if (!result) return jsonError("B-TALK 글을 찾을 수 없습니다.", 404);

  if (result.changed && liked && user) {
    const post = await (await getMongoDb())
      .collection<LikeTargetPost>("community_b_talk")
      .findOne({ $and: [{ id }, publicContentFilter] });
    if (post?.ownerId) {
      const href = `/community/b-talk/${post.id.replace(/^recipe-/, "b-talk-")}`;
      const body = `${user.handle ?? user.name}님이 내 B-TALK 글을 좋아합니다.`;
      scheduleMemberActivityNotification({
        recipientId: post.ownerId,
        actorId: user.id,
        settingKey: "communityLikes",
        kind: "like",
        title: body,
        href,
        pushTitle: "새 좋아요",
        pushBody: body,
      });
    }
  }

  const response = NextResponse.json({
    likes: result.likes,
    liked: result.liked,
  });
  setLikeIdentityCookie(response, result.visitorId);
  return response;
}
