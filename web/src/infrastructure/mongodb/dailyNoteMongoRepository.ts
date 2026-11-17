import type { Db } from "mongodb";
import type {
  DailyNote,
  DailyNoteComment,
  DailyNoteCursor,
  DailyNoteFeedItem,
  DailyNoteTechnicals,
  DailyNoteTechnicalKey,
} from "@/domain/daily-note/dailyNote";
import { encodeDailyNoteCursor } from "@/domain/daily-note/dailyNote";
import { publicContentFilter } from "@/infrastructure/mongodb/adminContentMongoRepository";
import { getMongoDb, toDomain } from "@/infrastructure/mongodb/client";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";

type StoredDailyNote = DailyNote & { ownerId: string };
export const MAX_DAILY_NOTE_COMMENTS = 1000;
type AddCommentResult =
  | { status: "added"; note: DailyNote }
  | { status: "not-found" }
  | { status: "limit-reached" };

export const DAILY_NOTE_FEED_PROJECTION = {
  _id: 0,
  id: 1,
  imageUrls: { $slice: 1 },
  technicals: 1,
  featuredTechnicalKeys: 1,
  createdAt: 1,
} as const;

export class DailyNoteMongoRepository {
  async list(input: {
    cursor?: DailyNoteCursor | null;
    limit: number;
    blockedOwnerIds?: string[];
    ownerId?: string;
  }) {
    await ensureMongoIndexes();
    const db = await getMongoDb();
    const cursorFilter = input.cursor
      ? {
          $or: [
            { createdAt: { $lt: input.cursor.createdAt } },
            {
              createdAt: input.cursor.createdAt,
              id: { $lt: input.cursor.id },
            },
          ],
        }
      : {};
    const notes = await db
      .collection<StoredDailyNote>("community_daily_notes")
      .find<DailyNoteFeedItem>(
        {
          $and: [
            publicContentFilter,
            cursorFilter,
            ...(input.blockedOwnerIds?.length
              ? [{ ownerId: { $nin: input.blockedOwnerIds } }]
              : []),
            ...(input.ownerId ? [{ ownerId: input.ownerId }] : []),
          ],
        },
        { projection: DAILY_NOTE_FEED_PROJECTION },
      )
      .sort({ createdAt: -1, id: -1 })
      .limit(input.limit + 1)
      .toArray();
    const hasMore = notes.length > input.limit;
    const items = notes.slice(0, input.limit).map(toDailyNoteFeedItem);
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? encodeDailyNoteCursor(last) : undefined,
    };
  }

  async listPicked(
    input: {
      userId: string;
      cursor?: DailyNoteCursor | null;
      limit: number;
      blockedOwnerIds?: string[];
    },
    database?: Db,
  ) {
    if (!database) await ensureMongoIndexes();
    const db = database ?? (await getMongoDb());
    const favoriteProfiles = await db
      .collection<{ id: string; ownerId: string; deletedAt?: unknown }>(
        "member_favorites",
      )
      .find({
        ownerId: input.userId,
        deletedAt: { $exists: false },
      })
      .toArray();

    const allowedOwnerIds = favoriteProfiles
      .map((fav) => fav.id)
      .filter((id) => !input.blockedOwnerIds?.includes(id));

    if (allowedOwnerIds.length === 0) {
      return {
        items: [],
        nextCursor: undefined,
      };
    }

    const cursorFilter = input.cursor
      ? {
          $or: [
            { createdAt: { $lt: input.cursor.createdAt } },
            {
              createdAt: input.cursor.createdAt,
              id: { $lt: input.cursor.id },
            },
          ],
        }
      : {};

    const notes = await db
      .collection<StoredDailyNote>("community_daily_notes")
      .find<StoredDailyNote>(
        {
          $and: [
            publicContentFilter,
            cursorFilter,
            { ownerId: { $in: allowedOwnerIds } },
          ],
        },
        {
          projection: {
            _id: 0,
            id: 1,
            author: 1,
            imageUrls: 1,
            note: 1,
            location: 1,
            technicals: 1,
            featuredTechnicalKeys: 1,
            createdAt: 1,
            likeCount: 1,
            commentCount: 1,
          },
        },
      )
      .sort({ createdAt: -1, id: -1 })
      .limit(input.limit + 1)
      .toArray();

    const pagedNotes = notes.slice(0, input.limit);
    const noteIds = pagedNotes.map((note) => note.id);

    let likedSet = new Set<string>();
    if (noteIds.length > 0) {
      const userLikes = await db
        .collection<{ targetId: string }>("content_likes")
        .find({
          identityKey: `user:${input.userId}`,
          targetType: "community_daily_note",
          targetId: { $in: noteIds },
        })
        .toArray();
      likedSet = new Set(userLikes.map((like) => like.targetId));
    }

    const items = pagedNotes.map((note) => ({
      ...note,
      liked: likedSet.has(note.id),
    }));
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        notes.length > input.limit && last
          ? encodeDailyNoteCursor(last)
          : undefined,
    };
  }

  async findById(id: string, blockedOwnerIds?: string[], viewerId?: string) {
    await ensureMongoIndexes();
    const note = await (await getMongoDb())
      .collection<StoredDailyNote>("community_daily_notes")
      .findOne({
        $and: [
          { id },
          publicContentFilter,
          ...(blockedOwnerIds?.length
            ? [{ ownerId: { $nin: blockedOwnerIds } }]
            : []),
        ],
      });
    return note
      ? {
          ...toPublicDailyNote(note, viewerId),
          ...(viewerId
            ? {
                isOwner: note.ownerId === viewerId,
                canManage: note.ownerId === viewerId,
              }
            : {}),
        }
      : null;
  }

  async updateComment(
    id: string,
    commentId: string,
    ownerId: string,
    body: string,
  ) {
    await ensureMongoIndexes();
    const result = await (await getMongoDb())
      .collection<StoredDailyNote>("community_daily_notes")
      .updateOne(
        {
          $and: [
            { id },
            publicContentFilter,
            { comments: { $elemMatch: { id: commentId, ownerId } } },
          ],
        },
        { $set: { "comments.$[comment].body": body } },
        { arrayFilters: [{ "comment.id": commentId }] },
      );
    return result.matchedCount > 0;
  }

  async deleteComment(id: string, commentId: string, ownerId: string) {
    await ensureMongoIndexes();
    const result = await (await getMongoDb())
      .collection<StoredDailyNote>("community_daily_notes")
      .updateOne(
        {
          $and: [
            { id },
            publicContentFilter,
            { comments: { $elemMatch: { id: commentId, ownerId } } },
          ],
        },
        {
          $pull: { comments: { id: commentId } },
          $inc: { commentCount: -1 },
        },
      );
    return result.matchedCount > 0;
  }

  async create(note: StoredDailyNote) {
    await ensureMongoIndexes();
    await (await getMongoDb())
      .collection<StoredDailyNote>("community_daily_notes")
      .insertOne(note);
    return toPublicDailyNote(note);
  }

  async update(
    id: string,
    ownerId: string,
    input: {
      imageUrls: string[];
      technicals: DailyNoteTechnicals;
      featuredTechnicalKeys: DailyNoteTechnicalKey[];
      note?: string;
      location?: DailyNote["location"];
    },
  ) {
    await ensureMongoIndexes();
    const update = {
      $set: {
        imageUrls: input.imageUrls,
        technicals: input.technicals,
        featuredTechnicalKeys: input.featuredTechnicalKeys,
        ...(input.note ? { note: input.note } : {}),
        ...(input.location ? { location: input.location } : {}),
      },
      $unset: {
        ...(input.note ? {} : { note: "" as const }),
        ...(input.location ? {} : { location: "" as const }),
      },
    };
    const updated = await (await getMongoDb())
      .collection<StoredDailyNote>("community_daily_notes")
      .findOneAndUpdate({ id, ownerId }, update, { returnDocument: "after" });
    return updated ? toPublicDailyNote(updated) : null;
  }

  async delete(id: string, ownerId: string) {
    await ensureMongoIndexes();
    const result = await (await getMongoDb())
      .collection<StoredDailyNote>("community_daily_notes")
      .deleteOne({ id, ownerId });
    return result.deletedCount > 0;
  }

  async addComment(
    id: string,
    comment: DailyNoteComment & { ownerId: string },
    blockedOwnerIds?: string[],
  ): Promise<AddCommentResult> {
    await ensureMongoIndexes();
    const updated = await (await getMongoDb())
      .collection<StoredDailyNote>("community_daily_notes")
      .findOneAndUpdate(
        {
          $and: [
            { id },
            publicContentFilter,
            ...(blockedOwnerIds?.length
              ? [{ ownerId: { $nin: blockedOwnerIds } }]
              : []),
            {
              $expr: {
                $lt: [
                  { $size: { $ifNull: ["$comments", []] } },
                  MAX_DAILY_NOTE_COMMENTS,
                ],
              },
            },
          ],
        },
        { $push: { comments: comment }, $inc: { commentCount: 1 } },
        { returnDocument: "after" },
      );
    if (updated) return { status: "added", note: toPublicDailyNote(updated) };
    return (await this.findById(id, blockedOwnerIds))
      ? { status: "limit-reached" }
      : { status: "not-found" };
  }
}

export function toDailyNoteFeedItem(
  note: DailyNoteFeedItem,
): DailyNoteFeedItem {
  const technicals: DailyNoteFeedItem["technicals"] = {};
  note.featuredTechnicalKeys.forEach((key) => {
    const value = note.technicals[key];
    if (value !== undefined && value !== "")
      Object.assign(technicals, { [key]: value });
  });
  return {
    id: note.id,
    imageUrls: note.imageUrls.slice(0, 1),
    technicals,
    featuredTechnicalKeys: note.featuredTechnicalKeys,
    createdAt: note.createdAt,
  };
}

function toPublicDailyNote(note: StoredDailyNote, viewerId?: string) {
  const dailyNote = toDomain(note);
  return {
    ...dailyNote,
    comments: dailyNote.comments?.map((item) =>
      toPublicDailyNoteComment(item, viewerId),
    ),
  };
}

export function toPublicDailyNoteComment(
  item: DailyNoteComment & { ownerId?: string },
  viewerId?: string,
): DailyNoteComment {
  const { ownerId, ...comment } = item;
  const isOwner = Boolean(viewerId && ownerId && ownerId === viewerId);
  return { ...comment, isOwner, canManage: isOwner };
}
