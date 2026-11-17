import { type NextRequest, NextResponse } from "next/server";
import type { QaPost } from "@/domain/community/types";
import type { MyActivityItem } from "@/domain/member/types";
import { getMongoDb, toDomain } from "@/infrastructure/mongodb/client";
import { upsertQaSearchDocument } from "@/infrastructure/mongodb/searchMongoRepository";
import {
  createId,
  createdAgoNow,
  firstOrFallback,
  nowIso,
} from "@/infrastructure/server/content";
import {
  compactStrings,
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { requireContentWriteAllowed } from "@/infrastructure/server/sanctions";
import {
  PROHIBITED_PUBLIC_CONTENT,
  prohibitedPublicContent,
} from "@/infrastructure/server/ugcModeration";

type CreateQaRequest = {
  title: string;
  body: string;
  imageUrl?: string;
  imageUrls?: string[];
  authorName?: string;
};

type OwnedQaPost = QaPost & { ownerId?: string };

export async function POST(request: NextRequest) {
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
  const body = await readJson<CreateQaRequest>(request);
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

  const post: OwnedQaPost = {
    id: createId("qa"),
    title,
    authorName: user?.handle ?? firstOrFallback(body.authorName, "익명"),
    createdAgo: createdAgoNow(),
    createdAt: nowIso(),
    commentCount: 0,
    imageUrl,
    imageUrls,
    body: content,
    likes: 0,
    liked: false,
    viewCount: 0,
    comments: [],
  };
  if (user) post.ownerId = user.id;

  const db = await getMongoDb();
  await db.collection<OwnedQaPost>("community_qa_posts").insertOne(post);
  await upsertQaSearchDocument(post);

  if (user) {
    await db
      .collection<MyActivityItem & { ownerId: string }>("member_activities")
      .insertOne({
        ownerId: user.id,
        id: createId("activity"),
        kind: "post",
        board: "Q&A",
        title,
        excerpt: content,
        createdAt: post.createdAt,
        commentCount: 0,
        likeCount: 0,
        href: `/community/qa/${post.id}`,
      });
  }
  return NextResponse.json(
    { ...toDomain(post), isOwner: Boolean(user) },
    { status: 201 },
  );
}
