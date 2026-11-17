import { type NextRequest, NextResponse } from "next/server";
import type { QaPost } from "@/domain/community/types";
import type { MyActivityItem } from "@/domain/member/types";
import { publicContentFilter } from "@/infrastructure/mongodb/adminContentMongoRepository";
import { isContentOwner } from "@/infrastructure/server/contentOwnership";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import {
  deleteSourceSearchDocument,
  upsertQaSearchDocument,
} from "@/infrastructure/mongodb/searchMongoRepository";
import {
  getCurrentAdminUser,
  getCurrentUser,
} from "@/infrastructure/server/auth";
import { requireContentWriteAllowed } from "@/infrastructure/server/sanctions";
import {
  PROHIBITED_PUBLIC_CONTENT,
  prohibitedPublicContent,
} from "@/infrastructure/server/ugcModeration";
import {
  compactStrings,
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";

type Params = Promise<{ id: string }>;
type OwnedQaPost = QaPost & { ownerId?: string };

type UpdateQaRequest = {
  title: string;
  body: string;
  imageUrl?: string;
  imageUrls?: string[];
};

export async function PATCH(
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
  const isAdmin = Boolean(await getCurrentAdminUser(request));

  const { id } = await params;
  const db = await getMongoDb();
  const post = await db
    .collection<OwnedQaPost>("community_qa_posts")
    .findOne({ $and: [{ id }, publicContentFilter] });
  if (!post) return jsonError("질문을 찾을 수 없습니다.", 404);
  if (!isAdmin && !isOwner(post, user))
    return jsonError("질문을 수정할 권한이 없습니다.", 403);

  const body = await readJson<UpdateQaRequest>(request);
  const title = requireString(body.title);
  const content = requireString(body.body);
  if (!title || !content) return jsonError("질문 제목과 내용을 입력해주세요.");
  if (prohibitedPublicContent(title, content))
    return jsonError(
      PROHIBITED_PUBLIC_CONTENT.message,
      400,
      PROHIBITED_PUBLIC_CONTENT.code,
    );
  const requestedImageUrls = compactStrings(body.imageUrls).slice(0, 6);
  const imageUrl = requestedImageUrls[0] ?? body.imageUrl;
  const imageUrls = requestedImageUrls.length
    ? requestedImageUrls
    : imageUrl
      ? [imageUrl]
      : [];

  const updatedPost: OwnedQaPost = {
    ...post,
    title,
    body: content,
    imageUrl,
    imageUrls,
  };

  const result = await db
    .collection<OwnedQaPost>("community_qa_posts")
    .updateOne(
      { $and: [{ id }, publicContentFilter] },
      {
        $set: {
          title: updatedPost.title,
          body: updatedPost.body,
          imageUrl: updatedPost.imageUrl,
          imageUrls: updatedPost.imageUrls,
        },
      },
    );
  if (result.matchedCount === 0)
    return jsonError("질문을 찾을 수 없습니다.", 404);
  await upsertQaSearchDocument(updatedPost);

  return NextResponse.json({ success: true });
}

export async function DELETE(
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
  const isAdmin = Boolean(await getCurrentAdminUser(request));

  const { id } = await params;
  const db = await getMongoDb();
  const post = await db
    .collection<OwnedQaPost>("community_qa_posts")
    .findOne({ $and: [{ id }, publicContentFilter] });
  if (!post) return jsonError("질문을 찾을 수 없습니다.", 404);

  if (!isAdmin && !isOwner(post, user))
    return jsonError("작성한 질문만 삭제할 수 있습니다.", 403);

  const result = await db
    .collection<OwnedQaPost>("community_qa_posts")
    .deleteOne({ $and: [{ id }, publicContentFilter] });
  if (result.deletedCount === 0)
    return jsonError("질문을 찾을 수 없습니다.", 404);
  await deleteSourceSearchDocument("community_qa", id);
  await db
    .collection<MyActivityItem & { ownerId?: string }>("member_activities")
    .deleteMany({
      href: `/community/qa/${id}`,
      $or: [{ ownerId: user.id }, { ownerId: { $exists: false } }],
    });

  return NextResponse.json({ success: true });
}

function isOwner(
  post: Pick<OwnedQaPost, "ownerId" | "authorName">,
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
) {
  return isContentOwner(post.ownerId, user.id);
}
