import { randomUUID } from "node:crypto";
import type {
  AccountDeletionCleanupRepository,
  MongoCleanupObservation,
} from "@/application/member/accountDeletion";
import type { ClientSession, Db, Document, MongoClient } from "mongodb";
import { getMongoClient, getMongoDb } from "./client";

const WITHDRAWN_MEMBER_NAME = "탈퇴한 유저";

const IDENTITY_RULES = {
  ownerId: {
    names: ["authorName", "ownerName"],
    avatars: ["authorAvatarUrl", "ownerAvatarUrl"],
    profiles: ["author", "reviewer"],
  },
  authorId: {
    names: ["authorName"],
    avatars: ["authorAvatarUrl"],
    profiles: ["author"],
  },
  senderId: {
    names: ["senderName"],
    avatars: ["senderAvatarUrl"],
    profiles: [],
  },
  recipientId: {
    names: ["recipientName"],
    avatars: ["recipientAvatarUrl"],
    profiles: [],
  },
  counterpartId: {
    names: ["counterpartName"],
    avatars: ["counterpartAvatarUrl"],
    profiles: [],
  },
  requesterId: { names: ["requesterName"], avatars: [], profiles: [] },
  reporterId: { names: ["reporterName"], avatars: [], profiles: [] },
  targetId: { names: ["targetName"], avatars: [], profiles: [] },
  targetUserId: { names: [], avatars: [], profiles: ["targetSnapshot"] },
  userId: { names: ["userName"], avatars: [], profiles: [] },
  actorId: { names: ["actorName"], avatars: [], profiles: [] },
  resourceId: { names: [], avatars: [], profiles: [] },
} as const;

const referencePaths = [
  "ownerId",
  "authorId",
  "senderId",
  "recipientId",
  "counterpartId",
  "requesterId",
  "reporterId",
  "targetId",
  "targetUserId",
  "userId",
  "actorId",
  "resourceId",
  "comments.ownerId",
  "comments.authorId",
  "comments.targetUserId",
  "comments.replies.ownerId",
  "comments.replies.authorId",
  "comments.replies.targetUserId",
] as const;

export const preservedCollectionNames = [
  "member_notifications",
  "member_messages",
  "member_chat_rooms",
  "member_recipes",
  "community_events",
  "community_reviews",
  "community_b_talk",
  "community_daily_notes",
  "community_qa_posts",
  "store_reviews",
  "brew_guides",
  "partner_promotions",
  "partner_reviews",
  "reports",
  "user_sanctions",
  "admin_audit_logs",
  "search_documents",
] as const;

export function privateDeletionOperations(userId: string) {
  return [
    ["member_profiles", { ownerId: userId }],
    ["member_careers", { ownerId: userId }],
    ["member_profile_badge_assignments", { ownerId: userId }],
    ["member_portfolios", { ownerId: userId }],
    ["member_notifications", { ownerId: userId }],
    ["member_notification_settings", { ownerId: userId }],
    ["member_push_tokens", { ownerId: userId }],
    ["member_favorites", { $or: [{ ownerId: userId }, { profileId: userId }] }],
    ["member_activities", { ownerId: userId }],
    ["auth_recent_logins", { userId }],
    ["member_chat_rooms", { ownerId: userId }],
    ["community_event_requests", { requesterId: userId }],
    ["report_daily_quotas", { reporterId: userId }],
    ["content_likes", { identityKey: `user:${userId}` }],
    ["user_blocks", { $or: [{ blockerId: userId }, { blockedId: userId }] }],
    ["search_documents", { sourceType: "member_profile", ownerId: userId }],
    ["barista_showrooms", { userId }],
    ["menus", { baristaId: userId }],
    ["coupons", { baristaId: userId }],
    ["user_coupons", { userId }],
    ["member_last_locations", { userId }],
    ["store_favorites", { ownerId: userId }],
    ["showroom_beans", { baristaId: userId }],
    ["bean_reservations", { userId }],
    ["passport_presentations", { userId }],
    ["point_ledger", { userId }],
    ["store_staff_requests", { userId }],
  ] as const;
}

export function collectPersonalUploadUrls(
  profile: Document | null,
  portfolios: Document[],
): string[] {
  const profileUrls = [
    profile?.avatarUrl,
    ...(Array.isArray(profile?.baristaProfile?.certificateFileUrls)
      ? profile.baristaProfile.certificateFileUrls
      : []),
  ];
  const portfolioUrls = portfolios.flatMap((portfolio) =>
    Array.isArray(portfolio.imageUrls) ? portfolio.imageUrls : [],
  );
  return [
    ...new Set(
      [...profileUrls, ...portfolioUrls].filter(
        (url): url is string => typeof url === "string" && url.trim() !== "",
      ),
    ),
  ];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function anonymizeProfile(value: unknown, withdrawnId?: string): unknown {
  if (!isPlainObject(value)) return value;
  const profile: Record<string, unknown> = {
    ...value,
    name: WITHDRAWN_MEMBER_NAME,
    handle: "",
    ...(withdrawnId ? { id: withdrawnId } : {}),
  };
  for (const field of Object.keys(profile))
    if (/^avatar.*url$/i.test(field)) delete profile[field];
  return profile;
}

function anonymizeMessageNotification(
  document: Document,
  messageHref: string,
): Document {
  if (document.kind !== "message" || document.href !== messageHref)
    return document;
  const anonymized: Document = {
    ...document,
    title: `${WITHDRAWN_MEMBER_NAME}님이 대화를 보냈습니다.`,
  };
  delete anonymized.href;
  return anonymized;
}

export function anonymizeMemberReferences<T>(
  value: T,
  userId: string,
  withdrawnId: string,
): T {
  if (Array.isArray(value))
    return value.map((item) =>
      anonymizeMemberReferences(item, userId, withdrawnId),
    ) as T;
  if (!isPlainObject(value)) return value;

  const result: Record<string, unknown> = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      anonymizeMemberReferences(child, userId, withdrawnId),
    ]),
  );
  for (const [idField, rule] of Object.entries(IDENTITY_RULES)) {
    if (value[idField] !== userId) continue;
    result[idField] = withdrawnId;
    for (const field of rule.names)
      if (field in result) result[field] = WITHDRAWN_MEMBER_NAME;
    for (const field of rule.avatars) delete result[field];
    for (const field of rule.profiles)
      if (field in result)
        result[field] = anonymizeProfile(
          result[field],
          idField === "targetUserId" ? withdrawnId : undefined,
        );
  }
  return result as T;
}

export class AccountDeletionMongoRepository implements AccountDeletionCleanupRepository {
  constructor(
    private readonly getClient: () => Promise<MongoClient> = getMongoClient,
    private readonly getDb: () => Promise<Db> = getMongoDb,
  ) {}

  async observe(userId: string): Promise<MongoCleanupObservation> {
    const db = await this.getDb();
    const referenceFilter = this.referenceFilter(userId);
    const messageFilter = this.messageFilter(userId, referenceFilter);
    const privateFilters = new Map<string, Document>(
      privateDeletionOperations(userId).map(([collection, filter]) => [
        collection,
        filter as Document,
      ]),
    );
    const collectionNames = new Set<string>([
      "users",
      ...privateFilters.keys(),
      ...preservedCollectionNames,
    ]);
    const [profile, portfolios, ...counts] = await Promise.all([
      db.collection<Document>("member_profiles").findOne(
        { ownerId: userId },
        {
          projection: {
            avatarUrl: 1,
            "baristaProfile.certificateFileUrls": 1,
          },
        },
      ),
      db
        .collection<Document>("member_portfolios")
        .find({ ownerId: userId }, { projection: { imageUrls: 1 } })
        .toArray(),
      ...[...collectionNames].map((collection) =>
        db
          .collection(collection)
          .countDocuments(
            this.observationFilter(
              collection,
              userId,
              privateFilters.get(collection),
              collection === "member_notifications"
                ? messageFilter
                : referenceFilter,
            ),
          ),
      ),
    ]);
    return {
      residualCount: counts.reduce((total, count) => total + count, 0),
      legacyUploadUrls: collectPersonalUploadUrls(profile, portfolios),
    };
  }

  async cleanup(userId: string, withdrawnId: string): Promise<void> {
    const session = (await this.getClient()).startSession();
    try {
      await session.withTransaction(() =>
        this.cleanupInTransaction(userId, withdrawnId, session),
      );
    } finally {
      await session.endSession();
    }
  }

  private referenceFilter(userId: string): Document {
    return { $or: referencePaths.map((path) => ({ [path]: userId })) };
  }

  private messageFilter(userId: string, referenceFilter: Document): Document {
    return {
      $or: [
        ...((referenceFilter.$or as Document[]) ?? []),
        {
          kind: "message",
          href: `/mypage/messages?thread=${encodeURIComponent(userId)}`,
        },
      ],
    };
  }

  private observationFilter(
    collection: string,
    userId: string,
    privateFilter: Document | undefined,
    preservedFilter: Document,
  ): Document {
    if (collection === "users") return { id: userId };
    const isPreserved = (
      preservedCollectionNames as readonly string[]
    ).includes(collection);
    if (!privateFilter) return preservedFilter;
    if (!isPreserved) return privateFilter;
    return { $or: [privateFilter, preservedFilter] };
  }

  private async cancelBeanReservationsOnDeletion(
    db: Db,
    userId: string,
    session: ClientSession,
  ) {
    const at = new Date().toISOString();

    // 1. 사장 탈퇴: 본인 매장들의 미완료 예약을 일괄 취소하고 고객에게 알림 발송 (쇼룸 삭제 전)
    const ownedStores = await db
      .collection<Document>("barista_showrooms")
      .find({ userId }, { projection: { id: 1, storeName: 1 }, session })
      .toArray();
    if (ownedStores.length > 0) {
      const storeIds = ownedStores
        .map((s) => s.id)
        .filter((id): id is string => typeof id === "string");
      const storeNameMap = new Map(
        ownedStores.map((s) => [
          s.id as string,
          typeof s.storeName === "string" ? s.storeName : "매장",
        ]),
      );
      if (storeIds.length > 0) {
        await db
          .collection<Document>("brew_guides")
          .deleteMany({ storeId: { $in: storeIds } }, { session });
        await db
          .collection<Document>("store_staff_requests")
          .deleteMany({ storeId: { $in: storeIds } }, { session });
        const activeStoreReservations = await db
          .collection<Document>("bean_reservations")
          .find(
            {
              storeId: { $in: storeIds },
              status: { $in: ["REQUESTED", "CONFIRMED"] },
            },
            { session },
          )
          .toArray();
        for (const reservation of activeStoreReservations) {
          await db.collection<Document>("bean_reservations").updateOne(
            {
              id: reservation.id,
              status: { $in: ["REQUESTED", "CONFIRMED"] },
            },
            {
              $set: {
                status: "CANCELLED",
                rejectReason: "매장 탈퇴",
                updatedAt: at,
              },
              $push: {
                history: { status: "CANCELLED", by: "system", at },
              } as unknown as Document,
            },
            { session },
          );
          if (
            typeof reservation.userId === "string" &&
            reservation.userId !== userId
          ) {
            const storeName =
              storeNameMap.get(reservation.storeId as string) ?? "매장";
            const beanName =
              isPlainObject(reservation.beanSnapshot) &&
              typeof reservation.beanSnapshot.name === "string"
                ? reservation.beanSnapshot.name
                : "원두·드립백";
            await db.collection<Document>("member_notifications").insertOne(
              {
                id: `notif-${randomUUID()}`,
                ownerId: reservation.userId,
                kind: "reservation",
                title: `[예약 취소] ${storeName} · ${beanName} (${reservation.pickupDate}) - 매장 탈퇴`,
                createdAgo: "방금 전",
                createdAt: at,
                unread: true,
                href: "/passport#reservations",
              },
              { session },
            );
          }
        }
      }
    }

    // 2. 고객 탈퇴: 삭제 전 미완료 예약이 있던 매장 사장에게 매장당 1건 알림 발송
    const customerActiveReservations = await db
      .collection<Document>("bean_reservations")
      .find(
        { userId, status: { $in: ["REQUESTED", "CONFIRMED"] } },
        { projection: { storeId: 1 }, session },
      )
      .toArray();
    const affectedStoreIds = Array.from(
      new Set(
        customerActiveReservations
          .map((r) => r.storeId)
          .filter((id): id is string => typeof id === "string"),
      ),
    );
    if (affectedStoreIds.length > 0) {
      const affectedStores = await db
        .collection<Document>("barista_showrooms")
        .find(
          { id: { $in: affectedStoreIds } },
          { projection: { id: 1, userId: 1 }, session },
        )
        .toArray();
      for (const store of affectedStores) {
        if (typeof store.userId === "string" && store.userId !== userId) {
          await db.collection<Document>("member_notifications").insertOne(
            {
              id: `notif-${randomUUID()}`,
              ownerId: store.userId,
              kind: "reservation",
              title: "고객 탈퇴로 예약이 취소되었어요",
              createdAgo: "방금 전",
              createdAt: at,
              unread: true,
              href: "/showroom/manage#reservations",
            },
            { session },
          );
        }
      }
    }
  }

  private async cleanupInTransaction(
    userId: string,
    withdrawnId: string,
    session: ClientSession,
  ) {
    const db = await this.getDb();
    await this.cancelBeanReservationsOnDeletion(db, userId, session);
    for (const [collection, filter] of privateDeletionOperations(userId))
      await db
        .collection(collection)
        .deleteMany(filter as Document, { session });
    const referenceFilter = this.referenceFilter(userId);
    const messageHref = `/mypage/messages?thread=${encodeURIComponent(userId)}`;
    for (const collection of preservedCollectionNames) {
      const filter =
        collection === "member_notifications"
          ? {
              $or: [
                ...referenceFilter.$or,
                { kind: "message", href: messageHref },
              ],
            }
          : referenceFilter;
      const documents = await db
        .collection<Document>(collection)
        .find(filter, { session })
        .toArray();
      for (const document of documents) {
        const identityAnonymized = anonymizeMemberReferences(
          document,
          userId,
          withdrawnId,
        );
        const anonymized =
          collection === "member_notifications"
            ? anonymizeMessageNotification(identityAnonymized, messageHref)
            : identityAnonymized;
        await db
          .collection<Document>(collection)
          .replaceOne({ _id: document._id }, anonymized, { session });
      }
    }
    await db.collection("users").deleteOne({ id: userId }, { session });
  }
}
