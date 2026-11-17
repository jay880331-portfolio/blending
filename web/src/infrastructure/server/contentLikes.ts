import { randomBytes } from "node:crypto";
import type { ClientSession, Db } from "mongodb";
import type { NextRequest, NextResponse } from "next/server";
import { publicContentFilter } from "@/infrastructure/mongodb/adminContentMongoRepository";
import { getMongoClient, getMongoDb } from "@/infrastructure/mongodb/client";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { getCurrentUser } from "@/infrastructure/server/auth";

const LIKE_ID_COOKIE = "blending_like_id";

export type LikeTargetType =
  | "community_b_talk"
  | "community_qa"
  | "community_review"
  | "partner_promotion"
  | "partner_review"
  | "community_daily_note";

type ContentLikeTargetType =
  | LikeTargetType
  | "community_daily_note"
  | "community_qa_comment"
  | "community_b_talk_comment"
  | "community_daily_note_comment";

type EmbeddedComment = {
  id: string;
  likes?: number;
  ownerId?: string;
  replies?: EmbeddedComment[];
};

type EmbeddedCommentParent = {
  id: string;
  comments?: EmbeddedComment[];
};

type ContentLikeDocument = {
  targetType: ContentLikeTargetType;
  targetId: string;
  identityKey: string;
  createdAt: Date;
};

type LikeIdentity = {
  key: string;
  visitorId?: string;
};

type LikeTargetDocument = {
  id: string;
  likes?: number;
  likeCount?: number;
};

export async function getLikeIdentity(
  request: NextRequest,
  createVisitor = false,
): Promise<LikeIdentity | null> {
  const user = await getCurrentUser(request);
  if (user) return { key: `user:${user.id}` };

  const visitorId = request.cookies.get(LIKE_ID_COOKIE)?.value;
  if (visitorId) return { key: `visitor:${visitorId}`, visitorId };
  if (!createVisitor) return null;

  const newVisitorId = randomBytes(16).toString("hex");
  return { key: `visitor:${newVisitorId}`, visitorId: newVisitorId };
}

export function setLikeIdentityCookie(
  response: NextResponse,
  visitorId?: string,
) {
  if (!visitorId) return;

  response.cookies.set(LIKE_ID_COOKIE, visitorId, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function updateContentLike(
  request: NextRequest,
  input: {
    collectionName: string;
    targetType: ContentLikeTargetType;
    targetId: string;
    liked: boolean;
    countField?: "likes" | "likeCount";
  },
) {
  await ensureMongoIndexes();

  const identity = await getLikeIdentity(request, true);
  if (!identity) throw new Error("좋아요 식별자를 만들 수 없습니다.");

  const [client, db] = await Promise.all([getMongoClient(), getMongoDb()]);
  const session = client.startSession();
  try {
    const result = await session.withTransaction(() =>
      applyContentLikeMutation(db, session, {
        ...input,
        identityKey: identity.key,
      }),
    );
    return result ? { ...result, visitorId: identity.visitorId } : null;
  } finally {
    await session.endSession();
  }
}

export async function applyContentLikeMutation(
  db: Db,
  session: ClientSession,
  input: {
    collectionName: string;
    targetType: ContentLikeTargetType;
    targetId: string;
    liked: boolean;
    identityKey: string;
    countField?: "likes" | "likeCount";
  },
) {
  const collection = db.collection<LikeTargetDocument>(input.collectionName);
  const countField = input.countField ?? "likes";
  const target = await collection.findOne(
    { $and: [{ id: input.targetId }, publicContentFilter] },
    { session },
  );
  if (!target) return null;

  const likes = db.collection<ContentLikeDocument>("content_likes");
  const filter = {
    targetType: input.targetType,
    targetId: input.targetId,
    identityKey: input.identityKey,
  };
  const delta = input.liked
    ? (
        await likes.updateOne(
          filter,
          { $setOnInsert: { ...filter, createdAt: new Date() } },
          { upsert: true, session },
        )
      ).upsertedCount
    : -(await likes.deleteOne(filter, { session })).deletedCount;
  const updated =
    delta === 0
      ? target
      : await collection.findOneAndUpdate(
          { $and: [{ id: input.targetId }, publicContentFilter] },
          [
            {
              $set: {
                [countField]: {
                  $max: [
                    0,
                    { $add: [{ $ifNull: [`$${countField}`, 0] }, delta] },
                  ],
                },
              },
            },
          ],
          { returnDocument: "after", session },
        );

  return {
    liked: input.liked,
    likes: updated?.[countField] ?? target[countField] ?? 0,
    changed: delta !== 0,
  };
}

export async function likedTargetIds(
  db: Db,
  input: {
    identityKey?: string;
    targetType: ContentLikeTargetType;
    targetIds: string[];
  },
) {
  if (!input.identityKey || input.targetIds.length === 0)
    return new Set<string>();

  const likes = await db
    .collection<ContentLikeDocument>("content_likes")
    .find({
      identityKey: input.identityKey,
      targetType: input.targetType,
      targetId: { $in: input.targetIds },
    })
    .project<{ targetId: string }>({ targetId: 1, _id: 0 })
    .toArray();

  return new Set(likes.map((like) => like.targetId));
}

export function findEmbeddedComment(
  comments: EmbeddedComment[] | undefined,
  commentId: string,
) {
  for (const comment of comments ?? []) {
    if (comment.id === commentId) return { comment, nested: false as const };
    const reply = comment.replies?.find((item) => item.id === commentId);
    if (reply) return { comment: reply, nested: true as const };
  }
}

export async function updateEmbeddedCommentLike(
  request: NextRequest,
  input: {
    collectionName: string;
    targetType: ContentLikeTargetType;
    parentId: string;
    commentId: string;
    liked: boolean;
  },
) {
  await ensureMongoIndexes();

  const identity = await getLikeIdentity(request, true);
  if (!identity) throw new Error("좋아요 식별자를 만들 수 없습니다.");

  const [client, db] = await Promise.all([getMongoClient(), getMongoDb()]);
  const session = client.startSession();
  try {
    const result = await session.withTransaction(() =>
      applyEmbeddedCommentLikeMutation(db, session, {
        ...input,
        identityKey: identity.key,
      }),
    );
    return result ? { ...result, visitorId: identity.visitorId } : null;
  } finally {
    await session.endSession();
  }
}

export async function applyEmbeddedCommentLikeMutation(
  db: Db,
  session: ClientSession,
  input: {
    collectionName: string;
    targetType: ContentLikeTargetType;
    parentId: string;
    commentId: string;
    liked: boolean;
    identityKey: string;
  },
) {
  const collection = db.collection<EmbeddedCommentParent>(input.collectionName);
  const parent = await collection.findOne(
    { $and: [{ id: input.parentId }, publicContentFilter] },
    { session },
  );
  if (!parent) return null;
  const found = findEmbeddedComment(parent.comments, input.commentId);
  if (!found) return null;

  const likes = db.collection<ContentLikeDocument>("content_likes");
  const filter = {
    targetType: input.targetType,
    targetId: input.commentId,
    identityKey: input.identityKey,
  };
  const delta = input.liked
    ? (
        await likes.updateOne(
          filter,
          { $setOnInsert: { ...filter, createdAt: new Date() } },
          { upsert: true, session },
        )
      ).upsertedCount
    : -(await likes.deleteOne(filter, { session })).deletedCount;

  if (delta !== 0) {
    if (found.nested) {
      await collection.updateOne(
        { $and: [{ id: input.parentId }, publicContentFilter] },
        { $inc: { "comments.$[parent].replies.$[reply].likes": delta } },
        {
          session,
          arrayFilters: [
            { "parent.replies.id": input.commentId },
            { "reply.id": input.commentId },
          ],
        },
      );
    } else {
      await collection.updateOne(
        {
          $and: [
            { id: input.parentId },
            publicContentFilter,
            { "comments.id": input.commentId },
          ],
        },
        { $inc: { "comments.$.likes": delta } },
        { session },
      );
    }
  }

  return {
    liked: input.liked,
    likes: Math.max(0, (found.comment.likes ?? 0) + delta),
    changed: delta !== 0,
    commentOwnerId: found.comment.ownerId,
  };
}
