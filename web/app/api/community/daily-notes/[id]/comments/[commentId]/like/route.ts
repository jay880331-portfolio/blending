import type { NextRequest } from "next/server";
import { postEmbeddedCommentLike } from "@/infrastructure/server/commentLikeRoute";

type Params = Promise<{ id: string; commentId: string }>;

export async function POST(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { id, commentId } = await params;
  return postEmbeddedCommentLike(request, {
    parentId: id,
    commentId,
    collectionName: "community_daily_notes",
    targetType: "community_daily_note_comment",
    notFoundMessage: "댓글을 찾을 수 없습니다.",
    href: `/community/daily-note/${id}`,
  });
}
