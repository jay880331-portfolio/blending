import assert from "node:assert/strict";
import test from "node:test";
import {
  anonymizeMemberReferences,
  collectPersonalUploadUrls,
  AccountDeletionMongoRepository,
  preservedCollectionNames,
  privateDeletionOperations,
} from "./accountDeletionMongoRepository";

test("collectPersonalUploadUrls removes empty duplicate personal upload URLs", () => {
  assert.deepEqual(
    collectPersonalUploadUrls(
      {
        avatarUrl: "avatar.jpg",
        baristaProfile: { certificateFileUrls: ["certificate.pdf", ""] },
      },
      [{ imageUrls: ["portfolio.jpg", "avatar.jpg", null] }],
    ),
    ["avatar.jpg", "certificate.pdf", "portfolio.jpg"],
  );
});

test("anonymizeMemberReferences changes only the matching role identity", () => {
  const result = anonymizeMemberReferences(
    {
      ownerId: "user-1",
      author: { name: "실명", handle: "real", avatarUrl: "avatar.jpg" },
      comments: [
        {
          ownerId: "user-2",
          authorName: "다른 사용자",
          replies: [
            {
              ownerId: "user-1",
              authorName: "실명",
              authorAvatarUrl: "avatar.jpg",
            },
          ],
        },
      ],
      senderId: "user-2",
      senderName: "다른 사용자",
      recipientId: "user-1",
      recipientName: "실명",
      recipientAvatarUrl: "avatar.jpg",
    },
    "user-1",
    "withdrawn:fixed",
  );

  assert.deepEqual(result, {
    ownerId: "withdrawn:fixed",
    author: { name: "탈퇴한 유저", handle: "" },
    comments: [
      {
        ownerId: "user-2",
        authorName: "다른 사용자",
        replies: [{ ownerId: "withdrawn:fixed", authorName: "탈퇴한 유저" }],
      },
    ],
    senderId: "user-2",
    senderName: "다른 사용자",
    recipientId: "withdrawn:fixed",
    recipientName: "탈퇴한 유저",
  });
});

test("cleanup anonymizes content report targets selected by targetUserId", async () => {
  const replacements: unknown[] = [];
  const reportFilters: unknown[] = [];
  const report = {
    _id: "content-report",
    id: "report-1",
    targetId: "content-1",
    targetUserId: "user-1",
    targetSnapshot: {
      id: "user-1",
      name: "실명",
      handle: "real",
      avatarUrl: "avatar.jpg",
      avatarThumbnailUrl: "avatar-thumb.jpg",
      collection: "community_b_talk",
      title: "보존할 신고 대상 본문",
    },
    reason: "spam",
  };
  const session = {
    withTransaction: async (work: () => Promise<void>) => work(),
    endSession: async () => undefined,
  };
  const db = {
    collection(name: string) {
      return {
        findOne: async () => (name === "users" ? {} : null),
        find: (filter: Record<string, unknown>) => {
          if (name === "reports") {
            reportFilters.push(filter);
            const targetsUser = JSON.stringify(filter).includes("targetUserId");
            return { toArray: async () => (targetsUser ? [report] : []) };
          }
          return { toArray: async () => [] };
        },
        deleteMany: async () => undefined,
        deleteOne: async () => ({ deletedCount: 1 }),
        replaceOne: async (_filter: unknown, document: unknown) => {
          if (name === "reports") replacements.push(document);
        },
      };
    },
  };

  await new AccountDeletionMongoRepository(
    async () => ({ startSession: () => session }) as never,
    async () => db as never,
  ).cleanup("user-1", "withdrawn:fixed");

  assert.equal(JSON.stringify(reportFilters).includes("targetUserId"), true);
  assert.deepEqual(replacements, [
    {
      _id: "content-report",
      id: "report-1",
      targetId: "content-1",
      targetUserId: "withdrawn:fixed",
      targetSnapshot: {
        id: "withdrawn:fixed",
        name: "탈퇴한 유저",
        handle: "",
        collection: "community_b_talk",
        title: "보존할 신고 대상 본문",
      },
      reason: "spam",
    },
  ]);
});

test("deletion policy keeps the exact owned and preserved collection boundaries", () => {
  assert.deepEqual(privateDeletionOperations("user-1"), [
    ["member_profiles", { ownerId: "user-1" }],
    ["member_careers", { ownerId: "user-1" }],
    ["member_profile_badge_assignments", { ownerId: "user-1" }],
    ["member_portfolios", { ownerId: "user-1" }],
    ["member_notifications", { ownerId: "user-1" }],
    ["member_notification_settings", { ownerId: "user-1" }],
    ["member_push_tokens", { ownerId: "user-1" }],
    [
      "member_favorites",
      { $or: [{ ownerId: "user-1" }, { profileId: "user-1" }] },
    ],
    ["member_activities", { ownerId: "user-1" }],
    ["auth_recent_logins", { userId: "user-1" }],
    ["member_chat_rooms", { ownerId: "user-1" }],
    ["community_event_requests", { requesterId: "user-1" }],
    ["report_daily_quotas", { reporterId: "user-1" }],
    ["content_likes", { identityKey: "user:user-1" }],
    [
      "user_blocks",
      { $or: [{ blockerId: "user-1" }, { blockedId: "user-1" }] },
    ],
    ["search_documents", { sourceType: "member_profile", ownerId: "user-1" }],
    ["barista_showrooms", { userId: "user-1" }],
    ["menus", { baristaId: "user-1" }],
    ["coupons", { baristaId: "user-1" }],
    ["user_coupons", { userId: "user-1" }],
    ["member_last_locations", { userId: "user-1" }],
    ["store_favorites", { ownerId: "user-1" }],
    ["showroom_beans", { baristaId: "user-1" }],
    ["bean_reservations", { userId: "user-1" }],
    ["passport_presentations", { userId: "user-1" }],
    ["point_ledger", { userId: "user-1" }],
    ["store_staff_requests", { userId: "user-1" }],
  ]);
  assert.equal(
    (
      privateDeletionOperations("user-1") as readonly (readonly [
        string,
        unknown,
      ])[]
    ).some(([name]) => name === "users"),
    false,
  );
  assert.deepEqual(preservedCollectionNames, [
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
  ]);
});

test("cleanup succeeds when the user document is already absent", async () => {
  const calls: Array<{ name: string; method: string; filter?: unknown }> = [];
  const session = {
    withTransaction: async (work: () => Promise<void>) => work(),
    endSession: async () => calls.push({ name: "session", method: "end" }),
  };
  const db = {
    collection(name: string) {
      return {
        findOne: async () => null,
        find: () => ({ toArray: async () => [] }),
        deleteMany: async (filter: unknown) => {
          calls.push({ name, method: "deleteMany", filter });
        },
        deleteOne: async (filter: unknown) => {
          calls.push({ name, method: "deleteOne", filter });
          return { deletedCount: 0 };
        },
        replaceOne: async () => undefined,
      };
    },
  };
  const repository = new AccountDeletionMongoRepository(
    async () => ({ startSession: () => session }) as never,
    async () => db as never,
  );

  await repository.cleanup("user-1", "withdrawn:fixed");
  await repository.cleanup("user-1", "withdrawn:fixed");

  assert.equal(
    calls.some(
      ({ name }) =>
        name === "phone_verifications" || name === "pending_social_signups",
    ),
    false,
  );
  assert.deepEqual(
    calls.find(({ name }) => name === "users"),
    {
      name: "users",
      method: "deleteOne",
      filter: { id: "user-1" },
    },
  );
  assert.equal(
    calls.filter(
      ({ name, method }) => name === "users" && method === "deleteOne",
    ).length,
    2,
  );
});

test("observe returns de-duplicated legacy upload URLs and residual count", async () => {
  const db = {
    collection(name: string) {
      return {
        findOne: async () =>
          name === "member_profiles"
            ? {
                avatarUrl: "avatar.jpg",
                baristaProfile: { certificateFileUrls: ["certificate.pdf"] },
              }
            : null,
        find: () => ({
          toArray: async () =>
            name === "member_portfolios"
              ? [{ imageUrls: ["avatar.jpg", "portfolio.jpg"] }]
              : [],
        }),
        countDocuments: async () =>
          name === "users" ||
          name === "member_profiles" ||
          name === "member_portfolios" ||
          name === "reports"
            ? 1
            : 0,
      };
    },
  };

  const observation = await new AccountDeletionMongoRepository(
    async () => ({}) as never,
    async () => db as never,
  ).observe("user-1");

  assert.deepEqual(observation, {
    residualCount: 4,
    legacyUploadUrls: ["avatar.jpg", "certificate.pdf", "portfolio.jpg"],
  });
});

test("observe counts only policy residual filters", async () => {
  const countFilters = new Map<string, unknown>();
  const db = {
    collection(name: string) {
      return {
        findOne: async () => null,
        find: () => ({ toArray: async () => [] }),
        countDocuments: async (filter: unknown) => {
          countFilters.set(name, filter);
          return 0;
        },
      };
    },
  };

  await new AccountDeletionMongoRepository(
    async () => ({}) as never,
    async () => db as never,
  ).observe("user-1");

  const references = {
    $or: [
      { ownerId: "user-1" },
      { authorId: "user-1" },
      { senderId: "user-1" },
      { recipientId: "user-1" },
      { counterpartId: "user-1" },
      { requesterId: "user-1" },
      { reporterId: "user-1" },
      { targetId: "user-1" },
      { targetUserId: "user-1" },
      { userId: "user-1" },
      { actorId: "user-1" },
      { resourceId: "user-1" },
      { "comments.ownerId": "user-1" },
      { "comments.authorId": "user-1" },
      { "comments.targetUserId": "user-1" },
      { "comments.replies.ownerId": "user-1" },
      { "comments.replies.authorId": "user-1" },
      { "comments.replies.targetUserId": "user-1" },
    ],
  };

  assert.deepEqual(countFilters.get("users"), { id: "user-1" });
  assert.deepEqual(countFilters.get("member_profiles"), { ownerId: "user-1" });
  assert.deepEqual(countFilters.get("member_favorites"), {
    $or: [{ ownerId: "user-1" }, { profileId: "user-1" }],
  });
  assert.deepEqual(countFilters.get("content_likes"), {
    identityKey: "user:user-1",
  });
  assert.deepEqual(countFilters.get("reports"), references);
  assert.deepEqual(countFilters.get("member_chat_rooms"), {
    $or: [{ ownerId: "user-1" }, references],
  });
  assert.deepEqual(countFilters.get("member_notifications"), {
    $or: [
      { ownerId: "user-1" },
      {
        $or: [
          ...references.$or,
          {
            kind: "message",
            href: "/mypage/messages?thread=user-1",
          },
        ],
      },
    ],
  });
});

test("cleanup removes private documents that arrive after an earlier pass", async () => {
  let profileExists = false;
  const session = {
    withTransaction: async (work: () => Promise<void>) => work(),
    endSession: async () => undefined,
  };
  const db = {
    collection(name: string) {
      return {
        findOne: async () =>
          profileExists && name === "member_profiles" ? {} : null,
        find: () => ({ toArray: async () => [] }),
        countDocuments: async () =>
          name === "member_profiles" && profileExists ? 1 : 0,
        deleteMany: async () => {
          if (name === "member_profiles") profileExists = false;
        },
        deleteOne: async () => ({ deletedCount: 0 }),
        replaceOne: async () => undefined,
      };
    },
  };
  const repository = new AccountDeletionMongoRepository(
    async () => ({ startSession: () => session }) as never,
    async () => db as never,
  );

  await repository.cleanup("user-1", "withdrawn:fixed");
  profileExists = true;
  assert.equal((await repository.observe("user-1")).residualCount, 1);

  await repository.cleanup("user-1", "withdrawn:fixed");
  assert.equal((await repository.observe("user-1")).residualCount, 0);
});

test("cleanup anonymizes preserved references that arrive after an earlier pass", async () => {
  let report: Record<string, unknown> | undefined;
  const session = {
    withTransaction: async (work: () => Promise<void>) => work(),
    endSession: async () => undefined,
  };
  const db = {
    collection(name: string) {
      return {
        findOne: async () => null,
        find: () => ({
          toArray: async () =>
            name === "reports" && report?.targetUserId === "user-1"
              ? [report]
              : [],
        }),
        countDocuments: async () =>
          name === "reports" && report?.targetUserId === "user-1" ? 1 : 0,
        deleteMany: async () => undefined,
        deleteOne: async () => ({ deletedCount: 0 }),
        replaceOne: async (
          _filter: unknown,
          document: Record<string, unknown>,
        ) => {
          if (name === "reports") report = document;
        },
      };
    },
  };
  const repository = new AccountDeletionMongoRepository(
    async () => ({ startSession: () => session }) as never,
    async () => db as never,
  );

  await repository.cleanup("user-1", "withdrawn:fixed");
  report = {
    _id: "late-report",
    targetUserId: "user-1",
    targetSnapshot: { id: "user-1", name: "실명", handle: "real" },
  };
  assert.equal((await repository.observe("user-1")).residualCount, 1);

  await repository.cleanup("user-1", "withdrawn:fixed");
  assert.deepEqual(report, {
    _id: "late-report",
    targetUserId: "withdrawn:fixed",
    targetSnapshot: { id: "withdrawn:fixed", name: "탈퇴한 유저", handle: "" },
  });
  assert.equal((await repository.observe("user-1")).residualCount, 0);
});

test("cleanup anonymizes only message notifications linked to the withdrawn sender", async () => {
  const replacements: unknown[] = [];
  const session = {
    withTransaction: async (work: () => Promise<void>) => work(),
    endSession: async () => undefined,
  };
  const db = {
    collection(name: string) {
      return {
        findOne: async () => (name === "users" ? {} : null),
        find: () => ({
          toArray: async () =>
            name === "member_notifications"
              ? [
                  {
                    _id: "message-notification",
                    ownerId: "recipient-1",
                    kind: "message",
                    title: "실명님이 대화를 보냈습니다.",
                    href: "/mypage/messages?thread=user-1",
                  },
                  {
                    _id: "other-notification",
                    ownerId: "recipient-1",
                    kind: "message",
                    title: "다른 사용자님이 대화를 보냈습니다.",
                    href: "/mypage/messages?thread=user-2",
                  },
                ]
              : [],
        }),
        deleteMany: async () => undefined,
        deleteOne: async () => ({ deletedCount: 1 }),
        replaceOne: async (_filter: unknown, document: unknown) => {
          if (name === "member_notifications") replacements.push(document);
        },
      };
    },
  };

  await new AccountDeletionMongoRepository(
    async () => ({ startSession: () => session }) as never,
    async () => db as never,
  ).cleanup("user-1", "withdrawn:fixed");

  assert.deepEqual(replacements, [
    {
      _id: "message-notification",
      ownerId: "recipient-1",
      kind: "message",
      title: "탈퇴한 유저님이 대화를 보냈습니다.",
    },
    {
      _id: "other-notification",
      ownerId: "recipient-1",
      kind: "message",
      title: "다른 사용자님이 대화를 보냈습니다.",
      href: "/mypage/messages?thread=user-2",
    },
  ]);
});

test("owner withdrawal cancels active bean reservations and notifies customers before showroom deletion", async () => {
  const ops: string[] = [];
  const updates: Array<{ filter: unknown; update: unknown }> = [];
  const insertedNotifications: Array<Record<string, unknown>> = [];
  const session = {
    withTransaction: async (work: () => Promise<void>) => work(),
    endSession: async () => undefined,
  };
  const db = {
    collection(name: string) {
      return {
        find: (filter: Record<string, unknown>) => ({
          toArray: async () => {
            if (name === "barista_showrooms" && filter.userId === "owner-1") {
              return [{ id: "store-1", storeName: "블렌딩 로스터리" }];
            }
            if (name === "bean_reservations" && "storeId" in filter) {
              return [
                {
                  id: "resv-1",
                  userId: "customer-1",
                  storeId: "store-1",
                  pickupDate: "2026-11-20",
                  beanSnapshot: { name: "에티오피아" },
                },
              ];
            }
            return [];
          },
        }),
        updateOne: async (filter: unknown, update: unknown) => {
          ops.push(`updateOne:${name}`);
          updates.push({ filter, update });
          return { modifiedCount: 1 };
        },
        insertOne: async (doc: Record<string, unknown>) => {
          ops.push(`insertOne:${name}`);
          if (name === "member_notifications") insertedNotifications.push(doc);
          return { insertedId: doc.id };
        },
        deleteMany: async () => {
          ops.push(`deleteMany:${name}`);
          return { deletedCount: 0 };
        },
        deleteOne: async () => ({ deletedCount: 1 }),
        replaceOne: async () => undefined,
      };
    },
  };

  await new AccountDeletionMongoRepository(
    async () => ({ startSession: () => session }) as never,
    async () => db as never,
  ).cleanup("owner-1", "withdrawn:fixed");

  assert.equal(updates.length, 1);
  assert.deepEqual(
    (updates[0].update as { $set: Record<string, unknown> }).$set.status,
    "CANCELLED",
  );
  assert.equal(
    (updates[0].update as { $set: Record<string, unknown> }).$set.rejectReason,
    "매장 탈퇴",
  );
  assert.equal(
    (
      updates[0].update as {
        $push: { history: { status: string; by: string } };
      }
    ).$push.history.by,
    "system",
  );
  assert.equal(insertedNotifications.length, 1);
  assert.equal(insertedNotifications[0].ownerId, "customer-1");
  assert.equal(insertedNotifications[0].kind, "reservation");
  assert.equal(insertedNotifications[0].href, "/passport#reservations");
  assert.ok(
    ops.indexOf("updateOne:bean_reservations") <
      ops.indexOf("deleteMany:barista_showrooms"),
  );
});

test("customer withdrawal notifies each affected store owner once before deleting reservations", async () => {
  const ops: string[] = [];
  const insertedNotifications: Array<Record<string, unknown>> = [];
  const session = {
    withTransaction: async (work: () => Promise<void>) => work(),
    endSession: async () => undefined,
  };
  const db = {
    collection(name: string) {
      return {
        find: (filter: Record<string, unknown>) => ({
          toArray: async () => {
            if (
              name === "bean_reservations" &&
              filter.userId === "customer-1"
            ) {
              return [
                { id: "resv-1", storeId: "store-1" },
                { id: "resv-2", storeId: "store-1" },
                { id: "resv-3", storeId: "store-2" },
              ];
            }
            if (name === "barista_showrooms" && "id" in filter) {
              return [
                { id: "store-1", userId: "owner-1" },
                { id: "store-2", userId: "owner-2" },
              ];
            }
            return [];
          },
        }),
        updateOne: async () => ({ modifiedCount: 0 }),
        insertOne: async (doc: Record<string, unknown>) => {
          ops.push(`insertOne:${name}`);
          if (name === "member_notifications") insertedNotifications.push(doc);
          return { insertedId: doc.id };
        },
        deleteMany: async () => {
          ops.push(`deleteMany:${name}`);
          return { deletedCount: 0 };
        },
        deleteOne: async () => ({ deletedCount: 1 }),
        replaceOne: async () => undefined,
      };
    },
  };

  await new AccountDeletionMongoRepository(
    async () => ({ startSession: () => session }) as never,
    async () => db as never,
  ).cleanup("customer-1", "withdrawn:fixed");

  assert.equal(insertedNotifications.length, 2);
  assert.deepEqual(
    insertedNotifications.map((n) => n.ownerId),
    ["owner-1", "owner-2"],
  );
  assert.equal(
    insertedNotifications[0].title,
    "고객 탈퇴로 예약이 취소되었어요",
  );
  assert.equal(insertedNotifications[0].href, "/showroom/manage#reservations");
  assert.ok(
    ops.indexOf("insertOne:member_notifications") <
      ops.indexOf("deleteMany:bean_reservations"),
  );
});
