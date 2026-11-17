import type {
  AdminCommentDto,
  AdminCommentPage,
  AdminPageSize,
  AdminReportDto,
  AdminReportListQuery,
  AdminReportPage,
  AdminSanctionDto,
  AdminSanctionListQuery,
  AdminSanctionPage,
  CreateReportInput,
} from "@blending/admin-contracts";
import type { ClientSession, Document, Filter } from "mongodb";
import type {
  ModerationDecisionRepository,
  ReportIngressRepository,
} from "@/application/admin/moderationUseCases";
import { ModerationActionError } from "@/application/admin/moderationUseCases";
import { ADMIN_CONTENT_COLLECTIONS } from "./adminContentMongoRepository";
import { getMongoDb } from "./client";
import { AdminUserMongoRepository } from "./adminUserMongoRepository";

const CONTENT_COLLECTIONS = Object.values(ADMIN_CONTENT_COLLECTIONS);
const REPORT_PROJECTION = { _id: 0 } as const;

export class AdminModerationMongoRepository
  implements ReportIngressRepository, ModerationDecisionRepository
{
  async countToday(reporterId: string, since: Date, session?: ClientSession) {
    return (await getMongoDb())
      .collection("reports")
      .countDocuments(
        { reporterId, createdAt: { $gte: since.toISOString() } },
        session ? { session } : undefined,
      );
  }
  async findOpen(
    reporterId: string,
    input: Pick<CreateReportInput, "targetType" | "targetId" | "parentId">,
    session?: ClientSession,
  ) {
    return (await getMongoDb()).collection("reports").findOne(
      {
        reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        parentId: input.parentId ?? null,
        status: { $in: ["open", "investigating"] },
      },
      { projection: REPORT_PROJECTION, ...(session ? { session } : {}) },
    );
  }
  async resolveTargetUserId(
    reporterId: string,
    input: Pick<CreateReportInput, "targetType" | "targetId" | "parentId">,
    session?: ClientSession,
  ) {
    const db = await getMongoDb();
    if (input.targetType === "user")
      return (
        (
          await db.collection<{ id: string }>("users").findOne(
            { id: input.targetId },
            {
              projection: { _id: 0, id: 1 },
              ...(session ? { session } : {}),
            },
          )
        )?.id ?? null
      );
    if (input.targetType === "message")
      return (
        (
          await db.collection<{ senderId?: string }>("member_messages").findOne(
            {
              id: input.targetId,
              $or: [{ senderId: reporterId }, { recipientId: reporterId }],
            },
            {
              projection: { _id: 0, senderId: 1 },
              ...(session ? { session } : {}),
            },
          )
        )?.senderId ?? null
      );
    for (const name of CONTENT_COLLECTIONS) {
      const filter =
        input.targetType === "comment"
          ? {
              id: input.parentId,
              $or: [
                { "comments.id": input.targetId },
                { "comments.replies.id": input.targetId },
              ],
            }
          : { id: input.targetId };
      const target = await db.collection(name).findOne(filter, {
        projection: { _id: 0, ownerId: 1, comments: 1 },
        ...(session ? { session } : {}),
      });
      if (!target) continue;
      if (input.targetType === "comment")
        return (
          findComment(
            (target.comments as Document[] | undefined) ?? [],
            input.targetId,
          )?.comment.ownerId ?? null
        );
      return typeof target.ownerId === "string" ? target.ownerId : null;
    }
    return null;
  }
  async targetExists(
    input: Pick<CreateReportInput, "targetType" | "targetId" | "parentId">,
    session?: ClientSession,
  ) {
    return Boolean(await this.targetSnapshot(input, session));
  }
  async create(value: Record<string, unknown>, session?: ClientSession) {
    const db = await getMongoDb();
    const targetSnapshot = await this.targetSnapshot(
      value as Pick<CreateReportInput, "targetType" | "targetId" | "parentId">,
      session,
    );
    const day = String(value.createdAt).slice(0, 10);
    const quota = await db
      .collection("report_daily_quotas")
      .findOneAndUpdate(
        { reporterId: value.reporterId, day, count: { $lt: 10 } },
        {
          $inc: { count: 1 },
          $setOnInsert: {
            reporterId: value.reporterId,
            day,
            expiresAt: new Date(
              new Date(`${day}T00:00:00.000Z`).getTime() + 2 * 86400000,
            ),
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          ...(session ? { session } : {}),
        },
      )
      .catch((error: unknown) => {
        if (isDuplicate(error)) return null;
        throw error;
      });
    if (!quota) throw new Error("신고는 하루 10건까지 접수할 수 있습니다.");
    try {
      await db
        .collection("reports")
        .insertOne(
          { ...value, targetSnapshot },
          session ? { session } : undefined,
        );
    } catch (error) {
      await db
        .collection("report_daily_quotas")
        .updateOne(
          { reporterId: value.reporterId, day },
          { $inc: { count: -1 } },
          session ? { session } : undefined,
        );
      if (isDuplicate(error)) throw new Error("이미 접수된 신고입니다.");
      throw error;
    }
    return { ...value, targetSnapshot };
  }
  private async targetSnapshot(
    input: Pick<CreateReportInput, "targetType" | "targetId" | "parentId">,
    session?: ClientSession,
  ) {
    const db = await getMongoDb();
    if (input.targetType === "user")
      return db.collection("users").findOne(
        { id: input.targetId },
        targetFindOptions(
          {
            _id: 0,
            id: 1,
            name: 1,
            handle: 1,
            role: 1,
            accountStatus: 1,
          },
          session,
        ),
      );
    if (input.targetType === "message")
      return db.collection("member_messages").findOne(
        { id: input.targetId },
        targetFindOptions(
          {
            _id: 0,
            id: 1,
            senderId: 1,
            recipientId: 1,
            body: 1,
            createdAt: 1,
          },
          session,
        ),
      );
    if (input.targetType === "comment") {
      for (const name of CONTENT_COLLECTIONS) {
        const parent = await db.collection(name).findOne(
          {
            id: input.parentId,
            $or: [
              { "comments.id": input.targetId },
              { "comments.replies.id": input.targetId },
            ],
          },
          targetFindOptions(
            {
              _id: 0,
              id: 1,
              comments: 1,
            },
            session,
          ),
        );
        const comment = findComment(
          (parent?.comments as Document[]) ?? [],
          input.targetId,
        )?.comment;
        if (comment)
          return {
            collection: name,
            parentId: parent?.id,
            id: comment.id,
            body: comment.body,
            ownerId: comment.ownerId,
            authorName: comment.authorName,
            isDeleted: comment.isDeleted === true,
          };
      }
      return null;
    }
    for (const name of CONTENT_COLLECTIONS) {
      const target = await db.collection(name).findOne(
        { id: input.targetId },
        targetFindOptions(
          {
            _id: 0,
            id: 1,
            title: 1,
            productName: 1,
            body: 1,
            ownerId: 1,
            moderationStatus: 1,
          },
          session,
        ),
      );
      if (target) return { collection: name, ...target };
    }
    return null;
  }

  async createBlock(
    blockerId: string,
    blockedId: string,
    session: ClientSession,
  ) {
    await (await getMongoDb()).collection("user_blocks").updateOne(
      { blockerId, blockedId },
      {
        $setOnInsert: {
          blockerId,
          blockedId,
          createdAt: new Date().toISOString(),
        },
      },
      { upsert: true, session },
    );
  }

  async listReports(query: AdminReportListQuery): Promise<AdminReportPage> {
    const page = query.page ?? 1,
      pageSize = query.pageSize ?? 20;
    const filter: Filter<Document> = {};
    if (query.status) filter.status = query.status;
    if (query.reason) filter.reason = query.reason;
    if (query.targetType) filter.targetType = query.targetType;
    if (query.q)
      filter.$or = ["detail", "resolution", "targetId", "reporterId"].map(
        (key) => ({ [key]: { $regex: escape(query.q!), $options: "i" } }),
      );
    const collection = (await getMongoDb()).collection<AdminReportDto>(
      "reports",
    );
    const [items, total] = await Promise.all([
      collection
        .find(filter, { projection: REPORT_PROJECTION })
        .sort({ createdAt: -1, id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      collection.countDocuments(filter),
    ]);
    return {
      items: items.map(reportActionTiming),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }
  async findReport(id: string) {
    const report = await (await getMongoDb())
      .collection<AdminReportDto>("reports")
      .findOne({ id }, { projection: REPORT_PROJECTION });
    return report ? reportActionTiming(report) : null;
  }
  async findForDecision(id: string, session: ClientSession) {
    return (await getMongoDb())
      .collection<{ targetType: string }>("reports")
      .findOne(
        { id, status: { $in: ["open", "investigating"] } },
        { session, projection: { _id: 0, targetType: 1 } },
      );
  }
  async resolvePending(
    id: string,
    patch: Record<string, unknown>,
    session: ClientSession,
  ) {
    return (await getMongoDb())
      .collection("reports")
      .findOneAndUpdate(
        { id, status: { $in: ["open", "investigating"] } },
        { $set: patch, $unset: { activeKey: "" } },
        { session, returnDocument: "after", projection: REPORT_PROJECTION },
      );
  }
  async applyContentAction(
    reportId: string,
    action: "hide" | "delete",
    resolution: string,
    session: ClientSession,
  ) {
    const db = await getMongoDb();
    const report = await db
      .collection("reports")
      .findOne({ id: reportId }, { session });
    if (!report || !["content", "comment"].includes(report.targetType))
      throw new ModerationActionError("조치할 신고 대상을 찾을 수 없습니다.");
    if (report.targetType === "comment") {
      const collection = report.targetSnapshot?.collection;
      const parentKind =
        collection === "community_b_talk"
          ? "b-talk"
          : collection === "community_qa_posts"
            ? "qa"
            : null;
      if (!parentKind || !report.parentId)
        throw new ModerationActionError("지원하지 않는 댓글 대상입니다.");
      const changed = await this.setCommentDeleted(
        parentKind,
        report.parentId,
        report.targetId,
        true,
        "moderation",
        resolution,
        session,
      );
      if (!changed)
        throw new ModerationActionError("댓글 상태가 변경되지 않았습니다.");
      return;
    }
    for (const name of CONTENT_COLLECTIONS) {
      const result = await db.collection(name).updateOne(
        { id: report.targetId },
        {
          $set: {
            moderationStatus: action === "hide" ? "hidden" : "deleted",
            moderationReason: resolution,
            updatedAt: new Date().toISOString(),
          },
        },
        { session },
      );
      if (result.matchedCount) return;
    }
    throw new ModerationActionError("조치할 콘텐츠를 찾을 수 없습니다.");
  }
  async createSanction(value: Record<string, unknown>, session: ClientSession) {
    const db = await getMongoDb();
    const report = await db
      .collection("reports")
      .findOne({ id: value.reportId }, { session });
    if (!report || report.targetType !== "user")
      throw new Error("사용자 신고에만 제재할 수 있습니다.");
    await db
      .collection("user_sanctions")
      .insertOne({ ...value, userId: report.targetId }, { session });
  }
  async updateUserStatus(
    reportId: string,
    status: "suspended" | "deleted",
    reason: string,
    session: ClientSession,
  ) {
    const report = await (await getMongoDb())
      .collection("reports")
      .findOne({ id: reportId }, { session });
    if (report?.targetType === "user")
      await new AdminUserMongoRepository().updateStatus(
        report.targetId,
        status,
        reason,
        session,
      );
    if (report?.targetType === "user")
      await (await getMongoDb()).collection("users").updateOne(
        { id: report.targetId },
        {
          $set: {
            accountStatusSource: "sanction",
            accountStatusSourceId: reportId,
          },
        },
        { session },
      );
  }
  async listSanctions(
    query: AdminSanctionListQuery,
  ): Promise<AdminSanctionPage> {
    const page = query.page ?? 1,
      pageSize = query.pageSize ?? 20;
    const filter: Filter<Document> = {};
    if (query.userId) filter.userId = query.userId;
    if (query.type) filter.type = query.type;
    if (query.active)
      Object.assign(filter, {
        revokedAt: { $exists: false },
        $or: [
          { endsAt: { $exists: false } },
          { endsAt: { $gt: new Date().toISOString() } },
        ],
      });
    const collection = (await getMongoDb()).collection<AdminSanctionDto>(
      "user_sanctions",
    );
    const [items, total] = await Promise.all([
      collection
        .find(filter, { projection: REPORT_PROJECTION })
        .sort({ createdAt: -1, id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      collection.countDocuments(filter),
    ]);
    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }
  async revokeSanction(
    id: string,
    actorId: string,
    reason: string,
    session: ClientSession,
  ) {
    const db = await getMongoDb(),
      collection = db.collection<AdminSanctionDto>("user_sanctions"),
      now = new Date().toISOString();
    const revoked = await collection.findOneAndUpdate(
      { id, revokedAt: { $exists: false } },
      { $set: { revokedAt: now, revokedBy: actorId, revokeReason: reason } },
      { session, returnDocument: "after", projection: REPORT_PROJECTION },
    );
    if (revoked && (revoked.type === "suspension" || revoked.type === "ban")) {
      const other = await collection.findOne(
        {
          userId: revoked.userId,
          id: { $ne: id },
          type: { $in: ["suspension", "ban"] },
          revokedAt: { $exists: false },
          $or: [{ endsAt: { $exists: false } }, { endsAt: { $gt: now } }],
        },
        { session },
      );
      const user = await db.collection("users").findOne(
        { id: revoked.userId },
        {
          session,
          projection: {
            _id: 0,
            accountStatusSource: 1,
            accountStatusSourceId: 1,
          },
        },
      );
      if (canClearSanctionStatus(user, Boolean(other)))
        await new AdminUserMongoRepository().updateStatus(
          revoked.userId,
          "active",
          reason,
          session,
        );
    }
    return revoked;
  }

  async listComments(
    page = 1,
    pageSize: AdminPageSize = 20,
    deleted?: boolean,
    parentKind?: "b-talk" | "qa",
    parentId?: string,
  ): Promise<AdminCommentPage> {
    const collection =
      parentKind === "qa" ? "community_qa_posts" : "community_b_talk";
    const [result = { items: [], count: [] }] = await (
      await getMongoDb()
    )
      .collection(collection)
      .aggregate<{ items: AdminCommentDto[]; count: { total: number }[] }>(
        commentListPipeline(page, pageSize, deleted, parentKind, parentId),
      )
      .toArray();
    const total = result.count[0]?.total ?? 0;
    return {
      items: result.items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }
  async setCommentDeleted(
    parentKind: "b-talk" | "qa",
    parentId: string,
    commentId: string,
    deleted: boolean,
    actorId: string,
    reason: string,
    session: ClientSession,
  ) {
    const collection = (await getMongoDb()).collection(
      parentKind === "b-talk" ? "community_b_talk" : "community_qa_posts",
    );
    const post = await collection.findOne(
      { id: parentId },
      { session, projection: { comments: 1 } },
    );
    const found = findComment((post?.comments as Document[]) ?? [], commentId);
    if (!found) return null;
    if (found.comment.isDeleted === deleted) return null;
    if (!deleted && (!found.comment.body || !found.comment.ownerId))
      throw new Error("원문이 없어 복구할 수 없습니다.");
    const path = found.nested
      ? "comments.$[parent].replies.$[reply]"
      : "comments.$[comment]";
    const update = deleted
      ? {
          $set: {
            [`${path}.isDeleted`]: true,
            [`${path}.deletedAt`]: new Date().toISOString(),
            [`${path}.deletedBy`]: actorId,
            [`${path}.deletionReason`]: reason,
          },
        }
      : {
          $set: {
            [`${path}.isDeleted`]: false,
            [`${path}.restoredAt`]: new Date().toISOString(),
            [`${path}.restoredBy`]: actorId,
          },
          $unset: {
            [`${path}.deletedAt`]: "",
            [`${path}.deletedBy`]: "",
            [`${path}.deletionReason`]: "",
          },
        };
    const arrayFilters = found.nested
      ? [{ "parent.replies.id": commentId }, { "reply.id": commentId }]
      : [{ "comment.id": commentId }];
    const expectedState = commentStateFilter(!deleted);
    const stateFilter = found.nested
      ? {
          "comments.replies": {
            $elemMatch: { id: commentId, isDeleted: expectedState },
          },
        }
      : {
          comments: { $elemMatch: { id: commentId, isDeleted: expectedState } },
        };
    const result = await collection.updateOne(
      { id: parentId, ...stateFilter },
      update,
      {
        session,
        arrayFilters,
      },
    );
    if (result.matchedCount !== 1) return null;
    return { ...found.comment, isDeleted: deleted };
  }
}

export function commentListPipeline(
  page: number,
  pageSize: number,
  deleted?: boolean,
  parentKind?: "b-talk" | "qa",
  parentId?: string,
): Document[] {
  const source = (parentKind: "b-talk" | "qa") => [
    {
      $project: {
        _id: 0,
        parentId: "$id",
        parentTitle: "$title",
        parentKind: { $literal: parentKind },
        comments: {
          $reduce: {
            input: { $ifNull: ["$comments", []] },
            initialValue: [],
            in: {
              $concatArrays: [
                "$$value",
                ["$$this"],
                { $ifNull: ["$$this.replies", []] },
              ],
            },
          },
        },
      },
    },
    { $unwind: "$comments" },
    {
      $replaceWith: {
        id: "$comments.id",
        parentKind: "$parentKind",
        parentId: "$parentId",
        parentTitle: "$parentTitle",
        ownerId: "$comments.ownerId",
        authorName: "$comments.authorName",
        body: { $ifNull: ["$comments.body", ""] },
        isDeleted: { $eq: ["$comments.isDeleted", true] },
        deletedAt: "$comments.deletedAt",
        restoreUnavailable: {
          $and: [
            { $eq: ["$comments.isDeleted", true] },
            {
              $or: [
                { $not: ["$comments.body"] },
                { $not: ["$comments.ownerId"] },
              ],
            },
          ],
        },
      },
    },
  ];
  if (parentKind)
    return [
      ...(parentId ? [{ $match: { id: parentId } }] : []),
      ...source(parentKind),
      ...(deleted === undefined ? [] : [{ $match: { isDeleted: deleted } }]),
      { $sort: { deletedAt: -1, id: -1 } },
      {
        $facet: {
          items: [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }],
          count: [{ $count: "total" }],
        },
      },
    ];
  return [
    ...source("b-talk"),
    { $unionWith: { coll: "community_qa_posts", pipeline: source("qa") } },
    ...(deleted === undefined ? [] : [{ $match: { isDeleted: deleted } }]),
    { $sort: { deletedAt: -1, id: -1 } },
    {
      $facet: {
        items: [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }],
        count: [{ $count: "total" }],
      },
    },
  ];
}

export function commentStateFilter(currentDeleted: boolean) {
  return currentDeleted ? true : { $ne: true };
}

export function canClearSanctionStatus(
  user: Document | null,
  hasOtherActiveBlockingSanction: boolean,
) {
  return (
    !hasOtherActiveBlockingSanction && user?.accountStatusSource === "sanction"
  );
}

export function reportActionTiming(report: AdminReportDto, now = Date.now()) {
  if (!["open", "investigating"].includes(report.status)) return report;
  const actionDueAt = new Date(
    new Date(report.createdAt).getTime() + 24 * 60 * 60 * 1000,
  ).toISOString();
  return {
    ...report,
    actionDueAt,
    actionOverdue: now > Date.parse(actionDueAt),
  };
}

export function targetFindOptions(
  projection: Document,
  session?: ClientSession,
) {
  return { projection, ...(session ? { session } : {}) };
}

function escape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function isDuplicate(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === 11000,
  );
}
function findComment(
  comments: Document[],
  id: string,
): { comment: Document; nested: boolean } | undefined {
  for (const comment of comments) {
    if (comment.id === id) return { comment, nested: false };
    const reply = ((comment.replies as Document[]) ?? []).find(
      (item) => item.id === id,
    );
    if (reply) return { comment: reply, nested: true };
  }
}
