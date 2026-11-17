import type {
  AdminRelatedItemAction,
  AdminUserCareerDto,
  AdminUserDto,
  AdminUserListQuery,
  AdminUserPage,
  AdminUserPortfolioDto,
  AdminUserProfileDto,
  AdminUserRelatedItemDto,
  AdminUserRelatedPage,
  AdminUserRelatedQuery,
  AdminUserRole,
  AdminUserStatus,
  CreateAdminManagedUserInput,
  UpdateAdminManagedUserInput,
} from "@blending/admin-contracts";
import {
  ObjectId,
  type ClientSession,
  type Document,
  type Filter,
  type Sort,
} from "mongodb";
import type {
  CareerItem,
  MemberProfile,
  NotificationSettings,
  PortfolioItem,
} from "@/domain/member/types";
import { profileFromUser } from "@/infrastructure/mongodb/memberMongoRepository";
import { syncProfileSearchDocument } from "@/infrastructure/mongodb/searchMongoRepository";
import { getMongoDb } from "./client";
import {
  createUserDocument,
  hashPassword,
  type UserDocument,
} from "@/infrastructure/server/auth";
import {
  activeAccountFilter,
  isActiveAccount,
} from "@/infrastructure/server/accountStatus";

const USER_PROJECTION = {
  _id: 0,
  id: 1,
  name: 1,
  handle: 1,
  phone: 1,
  email: 1,
  role: 1,
  accountStatus: 1,
  lastLoginMethod: 1,
  createdAt: 1,
  updatedAt: 1,
  lastLoginAt: 1,
} as const;

export class AdminUserConflictError extends Error {}
export class AdminUserNotFoundError extends Error {}

export class AdminUserMongoRepository {
  async findById(id: string): Promise<AdminUserDto | null> {
    const db = await getMongoDb();
    const user = await db
      .collection<UserDocument>("users")
      .findOne({ id }, { projection: USER_PROJECTION });
    return user ? toAdminUserDto(user) : null;
  }

  async findDetail(id: string) {
    const user = await this.findById(id);
    if (!user) return null;
    const isLastActiveAdmin =
      user.role === "admin" &&
      user.accountStatus === "active" &&
      (await (await getMongoDb())
        .collection<UserDocument>("users")
        .countDocuments({ role: "admin", ...activeAccountFilter() })) <= 1;
    return { ...user, isLastActiveAdmin };
  }

  async findLifecycleById(id: string, session: ClientSession) {
    const db = await getMongoDb();
    return db.collection<UserDocument>("users").findOne(
      { id },
      {
        projection: { _id: 0, id: 1, role: 1, accountStatus: 1 },
        session,
      },
    );
  }

  async countActiveAdmins(session: ClientSession) {
    const db = await getMongoDb();
    return db
      .collection<UserDocument>("users")
      .countDocuments({ role: "admin", ...activeAccountFilter() }, { session });
  }

  async lockAdminRoleGuard(session: ClientSession) {
    const db = await getMongoDb();
    await db.collection("app_configs").updateOne(
      { key: "admin_role_guard" },
      {
        $inc: { revision: 1 },
        $set: { updatedAt: new Date() },
        $setOnInsert: { key: "admin_role_guard" },
      },
      { upsert: true, session },
    );
  }

  async updateStatus(
    id: string,
    status: AdminUserStatus,
    reason: string,
    session: ClientSession,
  ) {
    const db = await getMongoDb();
    const result = await db.collection<UserDocument>("users").updateOne(
      this.lifecycleMutationFilter(id),
      {
        $set: {
          accountStatus: status,
          accountStatusReason: reason,
          updatedAt: new Date(),
        },
        $unset: { accountStatusSource: "", accountStatusSourceId: "" },
      },
      { session },
    );
    if (result.matchedCount !== 1) throw new AdminUserNotFoundError();

    const profile = await db
      .collection<{
        ownerId: string;
        isPortfolioPublic?: boolean;
      }>("member_profiles")
      .findOne({ ownerId: id }, { session });
    await db.collection("search_documents").updateMany(
      { ownerId: id, sourceType: "member_profile" },
      {
        $set: {
          visibility:
            status === "active" && profile?.isPortfolioPublic !== false
              ? "public"
              : "private",
        },
      },
      { session },
    );
  }

  async updateRole(id: string, role: AdminUserRole, session: ClientSession) {
    const db = await getMongoDb();
    const users = db.collection<UserDocument>("users");
    const user = await users.findOne({ id }, { session });
    if (!user) throw new AdminUserNotFoundError();

    const result = await users.updateOne(
      { id },
      { $set: { role, updatedAt: new Date() } },
      { session },
    );
    if (result.matchedCount !== 1) throw new AdminUserNotFoundError();

    const profiles = db.collection<MemberProfile & { ownerId?: string }>(
      "member_profiles",
    );
    await profiles.updateMany({ ownerId: id }, { $set: { role } }, { session });

    const ownerProfiles = await profiles
      .find({ ownerId: id }, { session })
      .toArray();
    if (role === "admin") {
      await db.collection("search_documents").deleteMany(
        {
          sourceType: "member_profile",
          $or: [
            { ownerId: id },
            { sourceId: { $in: ownerProfiles.map((profile) => profile.id) } },
          ],
        },
        { session },
      );
      return;
    }
    for (const profile of ownerProfiles) {
      await syncProfileSearchDocument(profile, session);
    }
  }

  async create(
    input: CreateAdminManagedUserInput,
    session: ClientSession,
    id?: string,
  ) {
    const db = await getMongoDb();
    const phone = normalizePhone(input.phone);
    const user = createUserDocument({
      phone,
      ...(input.email ? { email: input.email.trim().toLowerCase() } : {}),
      passwordHash: await hashPassword(input.password),
      name: input.name.trim(),
      role: input.role,
    });
    if (id) user.id = id;
    user.handle = input.handle.trim();
    user.accountStatus = "active";

    try {
      await db.collection<UserDocument>("users").insertOne(user, { session });
      const profile = profileFromUser(user);
      await db.collection("member_profiles").insertOne(profile, {
        session,
      });
      if (user.role !== "admin") {
        await db.collection("search_documents").insertOne(
          {
            id: `member_profile:${profile.id}`,
            sourceType: "member_profile",
            sourceId: profile.id,
            title: profile.name,
            body: profile.handle,
            keywords: [profile.role, profile.status],
            category: "프로필",
            authorName: profile.name,
            href: `/profile/${profile.id}`,
            visibility: "public",
            ownerId: user.id,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
          },
          { session },
        );
      }
    } catch (error) {
      if (isDuplicateKey(error)) throw new AdminUserConflictError();
      throw error;
    }
    return toAdminUserDto(user);
  }

  async update(
    id: string,
    input: UpdateAdminManagedUserInput,
    session: ClientSession,
  ) {
    const db = await getMongoDb();
    const patch = {
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.handle ? { handle: input.handle.trim() } : {}),
      ...(input.phone ? { phone: normalizePhone(input.phone) } : {}),
      ...(input.email ? { email: input.email.trim().toLowerCase() } : {}),
      updatedAt: new Date(),
    };
    try {
      const result = await db
        .collection<UserDocument>("users")
        .updateOne({ id }, { $set: patch }, { session });
      if (result.matchedCount !== 1) throw new AdminUserNotFoundError();
    } catch (error) {
      if (isDuplicateKey(error)) throw new AdminUserConflictError();
      throw error;
    }
    const publicPatch = {
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.handle ? { handle: input.handle.trim() } : {}),
    };
    if (Object.keys(publicPatch).length) {
      const profiles = db.collection<{
        ownerId: string;
        name: string;
        handle: string;
        workplace?: string;
        bio?: string;
        certificateName?: string;
      }>("member_profiles");
      await profiles.updateMany(
        { ownerId: id },
        { $set: publicPatch },
        { session },
      );
      const profile = await profiles.findOne({ ownerId: id }, { session });
      await db.collection("search_documents").updateMany(
        { ownerId: id, sourceType: "member_profile" },
        {
          $set: {
            ...(input.name
              ? { title: input.name.trim(), authorName: input.name.trim() }
              : {}),
            ...(profile ? toProfileSearchPatch(profile) : {}),
          },
        },
        { session },
      );
    }
  }

  async listRelated(
    userId: string,
    query: AdminUserRelatedQuery,
  ): Promise<AdminUserRelatedPage> {
    const db = await getMongoDb();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    if (query.kind === "settings") {
      const document = await db
        .collection<{
          ownerId: string;
          settings?: NotificationSettings;
        }>("member_notification_settings")
        .findOne({ ownerId: userId }, { projection: { _id: 0, settings: 1 } });
      const items = Object.entries(document?.settings ?? {}).map(
        ([key, enabled]) => ({ id: key, key, enabled }),
      );
      return relatedPage(
        items.slice(skip, skip + pageSize),
        items.length,
        page,
        pageSize,
      );
    }

    if (query.kind === "auth") {
      const [result] = await db
        .collection("auth_recent_logins")
        .aggregate<RelatedAggregateResult>([
          { $match: { userId } },
          {
            $project: {
              _id: 1,
              itemType: { $literal: "login" },
              method: 1,
              platform: 1,
              updatedAt: 1,
            },
          },
          {
            $unionWith: {
              coll: "member_push_tokens",
              pipeline: [
                { $match: { ownerId: userId } },
                {
                  $project: {
                    _id: 1,
                    itemType: { $literal: "push-token" },
                    manageable: { $literal: true },
                    disabled: 1,
                    updatedAt: { $ifNull: ["$updatedAt", "$revokedAt"] },
                  },
                },
              ],
            },
          },
          { $sort: { updatedAt: -1, _id: -1 } },
          relatedFacet(skip, pageSize),
        ])
        .toArray();
      return aggregateRelatedPage(result, page, pageSize);
    }

    if (query.kind === "messages") {
      const [result] = await db
        .collection("member_messages")
        .aggregate<RelatedAggregateResult>([
          { $match: { $or: [{ senderId: userId }, { recipientId: userId }] } },
          {
            $project: {
              _id: 0,
              id: 1,
              itemType: { $literal: "message" },
              manageable: { $literal: true },
              senderId: 1,
              recipientId: 1,
              createdAt: 1,
              sortAt: "$createdAt",
              read: 1,
              deletedAt: 1,
            },
          },
          {
            $unionWith: {
              coll: "member_chat_rooms",
              pipeline: [
                { $match: { ownerId: userId } },
                {
                  $project: {
                    _id: 0,
                    id: "$counterpartId",
                    itemType: { $literal: "chat-room" },
                    manageable: { $literal: false },
                    counterpartId: 1,
                    blocked: 1,
                    muted: 1,
                    leftAt: 1,
                    updatedAt: 1,
                    sortAt: { $ifNull: ["$updatedAt", "$leftAt"] },
                  },
                },
              ],
            },
          },
          { $sort: { sortAt: -1, id: -1 } },
          relatedFacet(skip, pageSize),
        ])
        .toArray();
      return aggregateRelatedPage(result, page, pageSize);
    }

    const spec = RELATED_COLLECTIONS[query.kind];
    const collection = db.collection<Record<string, unknown>>(spec.collection);
    const filter = { ownerId: userId };
    const [documents, total] = await Promise.all([
      collection
        .find(filter, { projection: spec.projection })
        .sort({ [spec.sortField]: -1, id: -1 })
        .skip(skip)
        .limit(pageSize)
        .toArray(),
      collection.countDocuments(filter),
    ]);
    return relatedPage(documents.map(toRelatedItem), total, page, pageSize);
  }

  async findRelatedMessage(userId: string, itemId: string) {
    const db = await getMongoDb();
    const message = await db
      .collection<Record<string, unknown>>("member_messages")
      .findOne(
        {
          id: itemId,
          $or: [{ senderId: userId }, { recipientId: userId }],
        },
        {
          projection: {
            _id: 0,
            id: 1,
            senderId: 1,
            recipientId: 1,
            createdAt: 1,
            read: 1,
            body: 1,
          },
        },
      );
    return message ? toRelatedItem(message) : null;
  }

  async mutateRelated(
    userId: string,
    kind: AdminUserRelatedQuery["kind"],
    itemId: string,
    input: AdminRelatedItemAction,
    session: ClientSession,
  ) {
    const db = await getMongoDb();
    await this.assertLifecycleMutable(userId, session);
    if (kind === "auth") {
      if (input.action !== "revoke")
        throw new Error("인증 이력은 삭제할 수 없습니다.");
      const result = await db.collection("member_push_tokens").updateOne(
        { ownerId: userId, _id: new ObjectId(itemId) },
        {
          $set: {
            disabled: true,
            revokedAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { session },
      );
      if (!result.matchedCount) throw new AdminUserNotFoundError();
      return true;
    }
    if (kind === "settings")
      throw new Error("설정은 enabled 값으로 수정해주세요.");
    const spec = RELATED_COLLECTIONS[kind];
    const filter: Document =
      kind === "messages"
        ? { id: itemId, $or: [{ senderId: userId }, { recipientId: userId }] }
        : { id: itemId, ownerId: userId };
    if (kind === "notifications") {
      const result = await db
        .collection(spec.collection)
        .deleteOne(filter, { session });
      if (!result.deletedCount) throw new AdminUserNotFoundError();
      return true;
    }
    if (input.action === "revoke") throw new Error("지원하지 않는 작업입니다.");
    const update =
      input.action === "soft-delete"
        ? { $set: { deletedAt: new Date().toISOString() } }
        : { $unset: { deletedAt: "" } };
    const collection = db.collection(spec.collection);
    const result = await collection.updateOne(
      {
        ...filter,
        ...(kind === "favorites" ? favoriteStateFilter(input.action) : {}),
      },
      update,
      { session },
    );
    if (!result.matchedCount) {
      if (
        kind === "favorites" &&
        (await collection.findOne(filter, {
          projection: { _id: 1 },
          session,
        }))
      )
        return false;
      throw new AdminUserNotFoundError();
    }
    if (kind === "favorites") {
      await db
        .collection("member_profiles")
        .updateOne({ ownerId: itemId }, favoriteCountUpdate(input.action), {
          session,
        });
    }
    return true;
  }

  async updateNotificationSetting(
    userId: string,
    key: string,
    enabled: boolean,
    session: ClientSession,
  ) {
    const db = await getMongoDb();
    const path = `settings.${key}`;
    const result = await db
      .collection("member_notification_settings")
      .updateOne(
        { ownerId: userId, [path]: { $exists: true } },
        { $set: { [path]: enabled, updatedAt: new Date() } },
        { session },
      );
    if (!result.matchedCount) throw new AdminUserNotFoundError();
  }

  async findProfile(userId: string): Promise<AdminUserProfileDto | null> {
    const db = await getMongoDb();
    return db
      .collection<AdminUserProfileDto>("member_profiles")
      .findOne({ ownerId: userId } as Filter<AdminUserProfileDto>, {
        projection: {
          _id: 0,
          id: 1,
          name: 1,
          handle: 1,
          workplace: 1,
          bio: 1,
          status: 1,
          isPortfolioPublic: 1,
        },
      });
  }

  async updateProfile(
    userId: string,
    patch: Partial<Omit<AdminUserProfileDto, "id">>,
    session: ClientSession,
  ) {
    const db = await getMongoDb();
    const result = await db
      .collection<MemberProfile & { ownerId: string }>("member_profiles")
      .updateOne({ ownerId: userId }, { $set: patch }, { session });
    if (!result.matchedCount) throw new AdminUserNotFoundError();
    if (patch.name || patch.handle) {
      await db.collection<UserDocument>("users").updateOne(
        { id: userId },
        {
          $set: {
            ...(patch.name ? { name: patch.name } : {}),
            ...(patch.handle ? { handle: patch.handle } : {}),
            updatedAt: new Date(),
          },
        },
        { session },
      );
      await db.collection("search_documents").updateMany(
        { ownerId: userId, sourceType: "member_profile" },
        {
          $set: {
            ...(patch.name
              ? { title: patch.name, authorName: patch.name }
              : {}),
            ...(patch.handle ? { body: patch.handle } : {}),
          },
        },
        { session },
      );
    }
    if (patch.isPortfolioPublic !== undefined) {
      const user = await db
        .collection<UserDocument>("users")
        .findOne({ id: userId }, { session });
      await db.collection("search_documents").updateMany(
        { ownerId: userId, sourceType: "member_profile" },
        {
          $set: {
            visibility:
              patch.isPortfolioPublic && isActiveAccount(user ?? {})
                ? "public"
                : "private",
          },
        },
        { session },
      );
    }
  }

  async listCareers(userId: string): Promise<AdminUserCareerDto[]> {
    const db = await getMongoDb();
    return db
      .collection<AdminUserCareerDto>("member_careers")
      .find({ ownerId: userId } as Filter<AdminUserCareerDto>, {
        projection: { _id: 0, ownerId: 0 },
      })
      .sort({ year: -1 })
      .toArray();
  }

  async saveCareer(
    userId: string,
    career: AdminUserCareerDto,
    session: ClientSession,
    create = false,
  ) {
    const db = await getMongoDb();
    const result = await db
      .collection<CareerItem & { ownerId: string }>("member_careers")
      .replaceOne(
        { ownerId: userId, id: career.id },
        { ...career, ownerId: userId },
        { upsert: create, session },
      );
    if (!create && !result.matchedCount) throw new AdminUserNotFoundError();
  }

  async deleteCareer(userId: string, careerId: string, session: ClientSession) {
    const db = await getMongoDb();
    const result = await db
      .collection("member_careers")
      .deleteOne({ ownerId: userId, id: careerId }, { session });
    if (!result.deletedCount) throw new AdminUserNotFoundError();
  }

  async listPortfolios(userId: string): Promise<AdminUserPortfolioDto[]> {
    const db = await getMongoDb();
    return db
      .collection<AdminUserPortfolioDto>("member_portfolios")
      .find({ ownerId: userId } as Filter<AdminUserPortfolioDto>, {
        projection: { _id: 0, ownerId: 0 },
      })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async savePortfolio(
    userId: string,
    portfolio: AdminUserPortfolioDto,
    session: ClientSession,
    create = false,
  ) {
    const db = await getMongoDb();
    const result = await db
      .collection<PortfolioItem & { ownerId: string }>("member_portfolios")
      .replaceOne(
        { ownerId: userId, id: portfolio.id },
        { ...portfolio, ownerId: userId },
        { upsert: create, session },
      );
    if (!create && !result.matchedCount) throw new AdminUserNotFoundError();
  }

  async deletePortfolio(
    userId: string,
    portfolioId: string,
    session: ClientSession,
  ) {
    const db = await getMongoDb();
    const result = await db
      .collection("member_portfolios")
      .deleteOne({ ownerId: userId, id: portfolioId }, { session });
    if (!result.deletedCount) throw new AdminUserNotFoundError();
  }

  async list(query: AdminUserListQuery): Promise<AdminUserPage> {
    const db = await getMongoDb();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const filter = toUserFilter(query);
    const sort = toUserSort(query);
    const users = db.collection<UserDocument>("users");
    const [items, total] = await Promise.all([
      users
        .find(filter, { projection: USER_PROJECTION })
        .sort(sort)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      users.countDocuments(filter),
    ]);
    return {
      items: items.map(toAdminUserDto),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  private lifecycleMutationFilter(id: string): Filter<UserDocument> {
    return { id, accountStatus: { $ne: "deleting" } };
  }

  private async assertLifecycleMutable(id: string, session: ClientSession) {
    const user = await (await getMongoDb())
      .collection<UserDocument>("users")
      .findOne(this.lifecycleMutationFilter(id), { session });
    if (!user) throw new AdminUserNotFoundError();
  }
}

const RELATED_COLLECTIONS = {
  activity: {
    collection: "member_activities",
    sortField: "createdAt",
    projection: {
      _id: 0,
      id: 1,
      kind: 1,
      title: 1,
      createdAt: 1,
      targetId: 1,
      deletedAt: 1,
    },
  },
  favorites: {
    collection: "member_favorites",
    sortField: "createdAt",
    projection: { _id: 0, id: 1, name: 1, createdAt: 1, deletedAt: 1 },
  },
  recipes: {
    collection: "member_recipes",
    sortField: "createdAt",
    projection: {
      _id: 0,
      id: 1,
      title: 1,
      category: 1,
      createdAt: 1,
      deletedAt: 1,
    },
  },
  notifications: {
    collection: "member_notifications",
    sortField: "_createdAt",
    projection: {
      _id: 0,
      id: 1,
      kind: 1,
      title: 1,
      unread: 1,
      createdAt: 1,
      _createdAt: 1,
    },
  },
  messages: {
    collection: "member_messages",
    sortField: "createdAt",
    projection: {
      _id: 0,
      id: 1,
      senderId: 1,
      recipientId: 1,
      createdAt: 1,
      read: 1,
      deletedAt: 1,
    },
  },
} as const;

export function toRelatedItem(
  document: Record<string, unknown>,
): AdminUserRelatedItemDto {
  const id = String(document.id ?? document._id ?? "");
  return {
    id,
    ...(document.itemType
      ? {
          itemType: String(
            document.itemType,
          ) as AdminUserRelatedItemDto["itemType"],
        }
      : {}),
    ...(typeof document.manageable === "boolean"
      ? { manageable: document.manageable }
      : {}),
    ...(document.kind
      ? { kind: String(document.kind), type: String(document.kind) }
      : {}),
    ...(document.title ? { title: String(document.title) } : {}),
    ...(document.targetId ? { targetId: String(document.targetId) } : {}),
    ...(document.name ? { name: String(document.name), profileId: id } : {}),
    ...(document.category ? { category: String(document.category) } : {}),
    ...(document.deletedAt
      ? { deletedAt: toDateString(document.deletedAt) }
      : {}),
    ...(typeof document.unread === "boolean" ? { read: !document.unread } : {}),
    ...(typeof document.read === "boolean" ? { read: document.read } : {}),
    ...(document.senderId ? { sender: String(document.senderId) } : {}),
    ...(document.recipientId
      ? { recipient: String(document.recipientId) }
      : {}),
    ...(document.createdAt
      ? {
          createdAt: toDateString(document.createdAt),
          timestamp: toDateString(document.createdAt),
        }
      : {}),
    ...(document.method ? { method: String(document.method) } : {}),
    ...(document.platform ? { platform: String(document.platform) } : {}),
    ...(document.lastLoginAt
      ? { lastLoginAt: toDateString(document.lastLoginAt) }
      : {}),
    ...(document.updatedAt
      ? { updatedAt: toDateString(document.updatedAt) }
      : {}),
    ...(document.disabled !== undefined
      ? { status: document.disabled ? "revoked" : "active" }
      : {}),
    ...(document.body ? { body: String(document.body) } : {}),
    ...(document.counterpartId
      ? { counterpartId: String(document.counterpartId) }
      : {}),
    ...(typeof document.blocked === "boolean"
      ? { blocked: document.blocked }
      : {}),
    ...(typeof document.muted === "boolean" ? { muted: document.muted } : {}),
    ...(document.leftAt ? { leftAt: toDateString(document.leftAt) } : {}),
  };
}

type RelatedAggregateResult = {
  items: Record<string, unknown>[];
  count: { total: number }[];
};

export function relatedFacet(skip: number, pageSize: number): Document {
  return {
    $facet: {
      items: [{ $skip: skip }, { $limit: pageSize }],
      count: [{ $count: "total" }],
    },
  };
}

export function favoriteStateFilter(
  action: "soft-delete" | "restore",
): Document {
  return {
    deletedAt: { $exists: action === "restore" },
  };
}

export function favoriteCountUpdate(
  action: "soft-delete" | "restore",
): Document[] {
  const count = { $ifNull: ["$favoriteCount", 0] };
  return [
    {
      $set: {
        favoriteCount:
          action === "restore"
            ? { $add: [count, 1] }
            : { $max: [0, { $subtract: [count, 1] }] },
      },
    },
  ];
}

function aggregateRelatedPage(
  result: RelatedAggregateResult | undefined,
  page: number,
  pageSize: AdminUserRelatedPage["pagination"]["pageSize"],
) {
  const total = result?.count[0]?.total ?? 0;
  return relatedPage(
    (result?.items ?? []).map(toRelatedItem),
    total,
    page,
    pageSize,
  );
}

function toDateString(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function relatedPage(
  items: AdminUserRelatedItemDto[],
  total: number,
  page: number,
  pageSize: AdminUserRelatedPage["pagination"]["pageSize"],
): AdminUserRelatedPage {
  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export function toProfileSearchPatch(profile: {
  handle: string;
  workplace?: string;
  bio?: string;
  certificateName?: string;
}) {
  return {
    body: [
      profile.handle,
      profile.workplace,
      profile.bio,
      profile.certificateName,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export function toAdminUserDto(user: UserDocument): AdminUserDto {
  return {
    id: user.id,
    name: user.name,
    ...(user.handle ? { handle: user.handle } : {}),
    ...(user.phone ? { phone: user.phone } : {}),
    ...(user.email ? { email: user.email } : {}),
    role: user.role,
    accountStatus:
      user.accountStatus === "deleting"
        ? "deleted"
        : (user.accountStatus ?? "active"),
    ...(user.lastLoginMethod ? { lastLoginMethod: user.lastLoginMethod } : {}),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    ...(user.lastLoginAt
      ? { lastLoginAt: user.lastLoginAt.toISOString() }
      : {}),
  };
}

export function toUserFilter(query: AdminUserListQuery): Filter<UserDocument> {
  const filter: Filter<UserDocument> = {};
  const clauses: Filter<UserDocument>[] = [];
  if (query.q) {
    const contains = {
      $regex: query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
    clauses.push({
      $or: [
        { name: contains },
        { handle: contains },
        { phone: contains },
        { email: contains },
      ],
    });
  }
  if (query.status === "active") clauses.push(activeAccountFilter());
  else if (query.status) filter.accountStatus = query.status as AdminUserStatus;
  if (query.role) filter.role = query.role;
  if (query.loginMethod) filter.lastLoginMethod = query.loginMethod;
  if (query.from || query.to) {
    filter.createdAt = {
      ...(query.from ? { $gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
      ...(query.to ? { $lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
    };
  }
  if (clauses.length) filter.$and = clauses;
  return filter;
}

export function toUserSort(query: AdminUserListQuery): Sort {
  const field = query.sort ?? "createdAt";
  const direction = query.direction === "asc" ? 1 : -1;
  return { [field]: direction, id: direction };
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function isDuplicateKey(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}
