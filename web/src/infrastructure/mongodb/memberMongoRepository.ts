import { calculateAvailablePoints } from "@/domain/passport/ledger";
import { getActiveLedgerEntries } from "@/infrastructure/server/passportRepository";
import type {
  BaristaProfileDetails,
  DirectChatRoomSetting,
  CareerItem,
  DirectMessage,
  FavoriteProfile,
  MemberAccountInfo,
  MemberInterestItem,
  MemberProfile,
  MemberRepository,
  PublicMemberRole,
  MemberSnapshot,
  MyActivityItem,
  MyRecipe,
  NotificationItem,
  NotificationSettings,
  PortfolioItem,
  SocialLinks,
  StatusMessage,
  WorkplaceLocation,
} from "@/domain/member/types";
import type { EventReview, QaPost, Recipe } from "@/domain/community/types";
import type { DailyNote } from "@/domain/daily-note/dailyNote";
import type { PartnerPromotion, PartnerReview } from "@/domain/partner/types";
import { defaultNotificationSettings } from "@/domain/member/types";
import { getMongoDb, toDomain } from "@/infrastructure/mongodb/client";
import { publicContentFilter } from "@/infrastructure/mongodb/adminContentMongoRepository";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { profileBadgeMongoRepository } from "@/infrastructure/mongodb/profileBadgeMongoRepository";
import { ensureSeedData } from "@/infrastructure/mongodb/seed";
import type { LikeTargetType } from "@/infrastructure/server/contentLikes";
import type { UserDocument } from "@/infrastructure/server/auth";
import { formatSeoulDateTime } from "@/domain/member/dateTime";
import { activeAccountFilter } from "@/infrastructure/server/accountStatus";
import {
  getAuthorProfileLookup,
  resolveAuthorName,
} from "@/infrastructure/mongodb/authorProfiles";
import { blockedOwnerFilter } from "@/application/community/blockedContent";

const emptySocials: SocialLinks = {
  instagram: "",
  threads: "",
  website: "",
  recipeUrl: "",
};

type ContentLikeDocument = {
  targetType: LikeTargetType;
  targetId: string;
  identityKey: string;
  createdAt: Date;
};

type NotificationSettingsDocument = {
  ownerId: string;
  settings: Partial<NotificationSettings> & {
    communityActivity?: boolean;
    communityReactions?: boolean;
  };
  updatedAt?: Date;
};

type DirectChatRoomSettingDocument = DirectChatRoomSetting & {
  ownerId: string;
  leftAt?: Date;
  updatedAt?: Date;
};

export function filterBlockedUserItems<T extends { id: string }>(
  items: T[],
  blockedUserIds: string[],
) {
  const blocked = new Set(blockedUserIds);
  return items.filter((item) => !blocked.has(item.id));
}

export function filterBlockedMessages<
  T extends { senderId: string; recipientId: string },
>(messages: T[], ownerId: string | undefined, blockedUserIds: string[]) {
  const blocked = new Set(blockedUserIds);
  return messages.filter((message) => {
    const counterpartId =
      message.senderId === ownerId ? message.recipientId : message.senderId;
    return !blocked.has(counterpartId);
  });
}

export class MemberMongoRepository implements MemberRepository {
  constructor(
    private readonly ownerId?: string,
    private readonly blockedUserIds: string[] = [],
  ) {}

  async getSnapshot(): Promise<MemberSnapshot> {
    await ensureMongoIndexes();
    await ensureSeedData();

    const db = await getMongoDb();
    const profileFilter = this.ownerId ? { ownerId: this.ownerId } : {};
    const profile = await db
      .collection<MemberProfile & { ownerId?: string }>("member_profiles")
      .findOne(profileFilter);
    const currentUser = this.ownerId
      ? await db
          .collection<UserDocument>("users")
          .findOne({ id: this.ownerId, ...activeAccountFilter() })
      : null;

    const scopedFilter = this.ownerId ? { ownerId: this.ownerId } : {};
    const [
      careers,
      portfolios,
      notifications,
      messages,
      chatRoomSettings,
      notificationSettings,
      favorites,
      favoriteFollowers,
      recipes,
      myActivities,
      interests,
    ] = await Promise.all([
      db
        .collection<CareerItem & { ownerId?: string }>("member_careers")
        .find(scopedFilter)
        .sort({ year: -1 })
        .toArray(),
      db
        .collection<PortfolioItem & { ownerId?: string }>("member_portfolios")
        .find(scopedFilter)
        .sort({ createdAt: -1 })
        .toArray(),
      db
        .collection<
          NotificationItem & { ownerId?: string }
        >("member_notifications")
        .find(scopedFilter)
        .sort({ _createdAt: -1, id: -1 })
        .toArray(),
      this.getMessages(),
      this.getChatRoomSettings(),
      this.getNotificationSettings(),
      db
        .collection<FavoriteProfile & { ownerId?: string; deletedAt?: string }>(
          "member_favorites",
        )
        .find({ ...scopedFilter, deletedAt: { $exists: false } })
        .toArray(),
      this.getFavoriteFollowers(),
      db
        .collection<MyRecipe & { ownerId?: string; deletedAt?: string }>(
          "member_recipes",
        )
        .find({ ...scopedFilter, deletedAt: { $exists: false } })
        .sort({ createdAt: -1 })
        .toArray(),
      this.getActivities(scopedFilter),
      this.getInterests(),
    ]);

    const fallbackProfile = this.ownerId
      ? null
      : await db.collection<MemberProfile>("member_profiles").findOne();
    const resolvedProfile =
      profileWithUserDefaults(
        profile ?? (currentUser ? profileFromUser(currentUser) : null),
        currentUser,
      ) ??
      fallbackProfile ??
      createGuestProfile();
    const officialBadges = this.ownerId
      ? await profileBadgeMongoRepository.listForOwner(this.ownerId)
      : [];

    let passportSummary: { balance: number; totalStamps: number } | undefined;
    if (this.ownerId) {
      const now = new Date();
      const [totalStamps, activeLedger] = await Promise.all([
        db
          .collection("passport_stamps")
          .countDocuments({ userId: this.ownerId }),
        getActiveLedgerEntries(db, this.ownerId, now),
      ]);
      passportSummary = {
        balance: calculateAvailablePoints(activeLedger, now),
        totalStamps,
      };
    }

    return {
      profile: {
        ...toDomain(resolvedProfile),
        officialBadges,
        ...(passportSummary ? { passportSummary } : {}),
        isOwnProfile: Boolean(this.ownerId),
      },
      account: accountInfoFromUser(currentUser),
      careers: careers.map(toDomain),
      portfolios: portfolios.map(toDomain),
      notifications: notifications.map(toDomain),
      messages,
      chatRoomSettings,
      notificationSettings,
      favorites: filterBlockedUserItems(favorites, this.blockedUserIds).map(
        toDomain,
      ),
      favoriteFollowers,
      recipes: recipes.map(toDomain),
      myActivities: myActivities.map(toDomain),
      interests,
    };
  }

  private async getMessages(): Promise<DirectMessage[]> {
    if (!this.ownerId) return [];

    const db = await getMongoDb();
    const chatRoomSettings = await db
      .collection<DirectChatRoomSettingDocument>("member_chat_rooms")
      .find({ ownerId: this.ownerId })
      .toArray();
    const hiddenBeforeByCounterpartId = new Map(
      chatRoomSettings
        .filter((setting) => setting.leftAt)
        .map((setting) => [setting.counterpartId, setting.leftAt as Date]),
    );
    const messages: Array<
      Omit<DirectMessage, "createdAt"> & {
        createdAt: Date;
        deletedAt?: string;
      }
    > = await db
      .collection<
        Omit<DirectMessage, "createdAt"> & {
          createdAt: Date;
          deletedAt?: string;
        }
      >("member_messages")
      .find({
        $or: [{ senderId: this.ownerId }, { recipientId: this.ownerId }],
        deletedAt: { $exists: false },
      })
      .sort({ createdAt: -1 })
      .toArray();

    const visibleMessages = filterBlockedMessages(
      messages,
      this.ownerId,
      this.blockedUserIds,
    ).filter((message) => {
      const counterpartId =
        message.senderId === this.ownerId
          ? message.recipientId
          : message.senderId;
      const leftAt = hiddenBeforeByCounterpartId.get(counterpartId);
      return !leftAt || message.createdAt > leftAt;
    });
    const counterpartIds = [
      ...new Set(
        visibleMessages.map((message) =>
          message.senderId === this.ownerId
            ? message.recipientId
            : message.senderId,
        ),
      ),
    ];
    const profiles = await db
      .collection<MemberProfile & { ownerId?: string }>("member_profiles")
      .find({ ownerId: { $in: counterpartIds } })
      .project({ ownerId: 1, avatarUrl: 1 })
      .toArray();
    const avatarByOwnerId = new Map(
      profiles.map((profile) => [profile.ownerId, profile.avatarUrl]),
    );

    return visibleMessages.map((message) => ({
      ...toDomain(message),
      senderAvatarUrl: avatarByOwnerId.get(message.senderId),
      recipientAvatarUrl: avatarByOwnerId.get(message.recipientId),
      read: message.recipientId === this.ownerId ? message.read : true,
      createdAt: formatSeoulDateTime(message.createdAt),
    }));
  }

  private async getChatRoomSettings(): Promise<DirectChatRoomSetting[]> {
    if (!this.ownerId) return [];

    const db = await getMongoDb();
    const settings = await db
      .collection<DirectChatRoomSettingDocument>("member_chat_rooms")
      .find({ ownerId: this.ownerId })
      .toArray();

    return settings
      .filter((setting) => !this.blockedUserIds.includes(setting.counterpartId))
      .map((setting) => ({
        counterpartId: setting.counterpartId,
        blocked: Boolean(setting.blocked),
        muted: Boolean(setting.muted),
        ...(setting.leftAt
          ? { leftAt: formatSeoulDateTime(setting.leftAt) }
          : {}),
      }));
  }

  private async getFavoriteFollowers(): Promise<FavoriteProfile[]> {
    if (!this.ownerId) return [];

    const db = await getMongoDb();
    const favorites = await db
      .collection<FavoriteProfile & { ownerId?: string; deletedAt?: string }>(
        "member_favorites",
      )
      .find({ id: this.ownerId, deletedAt: { $exists: false } })
      .toArray();
    const followerIds = favorites
      .map((favorite) => favorite.ownerId)
      .filter(
        (ownerId): ownerId is string =>
          ownerId !== undefined && !this.blockedUserIds.includes(ownerId),
      );

    if (followerIds.length === 0) return [];

    const [myFavorites, profiles, users] = await Promise.all([
      db
        .collection<FavoriteProfile & { ownerId?: string; deletedAt?: string }>(
          "member_favorites",
        )
        .find({
          ownerId: this.ownerId,
          id: { $in: followerIds },
          deletedAt: { $exists: false },
        })
        .toArray(),
      db
        .collection<MemberProfile & { ownerId?: string }>("member_profiles")
        .find({ ownerId: { $in: followerIds } })
        .toArray(),
      db
        .collection<UserDocument>("users")
        .find({ id: { $in: followerIds }, ...activeAccountFilter() })
        .toArray(),
    ]);
    const myFavoriteIds = new Set(myFavorites.map((favorite) => favorite.id));
    const profilesByOwnerId = new Map(
      profiles.map((profile) => [profile.ownerId, toDomain(profile)]),
    );
    const usersById = new Map(users.map((user) => [user.id, user]));

    return followerIds
      .filter((followerId) => usersById.has(followerId))
      .map((followerId) =>
        favoriteProfileFromMember({
          profile: profilesByOwnerId.get(followerId),
          user: usersById.get(followerId),
          profileId: followerId,
          favorited: myFavoriteIds.has(followerId),
        }),
      );
  }

  private async getNotificationSettings(): Promise<NotificationSettings> {
    if (!this.ownerId) return defaultNotificationSettings;

    const db = await getMongoDb();
    const document = await db
      .collection<NotificationSettingsDocument>("member_notification_settings")
      .findOne({ ownerId: this.ownerId });

    const legacyCommunityActivity = document?.settings.communityActivity;
    const legacyCommunityReactions = document?.settings.communityReactions;
    const legacyReactions =
      typeof legacyCommunityReactions === "boolean"
        ? legacyCommunityReactions
        : legacyCommunityActivity;

    return {
      ...defaultNotificationSettings,
      ...(typeof legacyReactions === "boolean"
        ? {
            communityLikes: legacyReactions,
            communityComments: legacyReactions,
            communityReplies: legacyReactions,
            interestActivity: legacyReactions,
            eventUpdates: legacyReactions,
          }
        : {}),
      ...(document?.settings ?? {}),
      accountSecurity: true,
    };
  }

  private async getInterests(): Promise<MemberInterestItem[]> {
    if (!this.ownerId) return [];

    const db = await getMongoDb();
    const likes = await db
      .collection<ContentLikeDocument>("content_likes")
      .find({
        identityKey: `user:${this.ownerId}`,
        targetType: {
          $in: [
            "community_b_talk",
            "community_qa",
            "community_review",
            "partner_promotion",
            "partner_review",
            "community_daily_note",
          ] satisfies LikeTargetType[],
        },
      })
      .sort({ createdAt: -1 })
      .toArray();

    const idsByType = groupLikeIds(likes);
    const [recipes, qaPosts, reviews, promotions, partnerReviews, dailyNotes] =
      await Promise.all([
        db
          .collection<Recipe & { ownerId?: string }>("community_b_talk")
          .find(
            interestSourceFilter(
              idsByType.community_b_talk,
              this.blockedUserIds,
            ),
          )
          .toArray(),
        db
          .collection<QaPost & { ownerId?: string }>("community_qa_posts")
          .find(
            interestSourceFilter(idsByType.community_qa, this.blockedUserIds),
          )
          .toArray(),
        db
          .collection<EventReview & { ownerId?: string }>("community_reviews")
          .find(
            interestSourceFilter(
              idsByType.community_review,
              this.blockedUserIds,
            ),
          )
          .toArray(),
        db
          .collection<
            PartnerPromotion & { ownerId?: string }
          >("partner_promotions")
          .find(
            interestSourceFilter(
              idsByType.partner_promotion,
              this.blockedUserIds,
            ),
          )
          .toArray(),
        db
          .collection<PartnerReview & { ownerId?: string }>("partner_reviews")
          .find(
            interestSourceFilter(idsByType.partner_review, this.blockedUserIds),
          )
          .toArray(),
        db
          .collection<DailyNote & { ownerId?: string }>("community_daily_notes")
          .find(
            interestSourceFilter(
              idsByType.community_daily_note,
              this.blockedUserIds,
            ),
          )
          .toArray(),
      ]);

    const recipeById = new Map(recipes.map((item) => [item.id, item]));
    const qaById = new Map(qaPosts.map((item) => [item.id, item]));
    const reviewById = new Map(reviews.map((item) => [item.id, item]));
    const promotionById = new Map(promotions.map((item) => [item.id, item]));
    const partnerReviewById = new Map(
      partnerReviews.map((item) => [item.id, item]),
    );
    const dailyNoteById = new Map(dailyNotes.map((item) => [item.id, item]));
    const authorProfileLookup = await getAuthorProfileLookup(db, [
      ...recipes.map((item) => ({
        ownerId: item.ownerId,
        name: item.author.name,
      })),
      ...qaPosts.map((item) => ({
        ownerId: item.ownerId,
        name: item.authorName,
      })),
      ...reviews.map((item) => ({
        ownerId: item.ownerId,
        name: item.author.name,
      })),
      ...promotions.map((item) => ({
        ownerId: item.ownerId,
        name: item.authorName,
      })),
      ...partnerReviews.map((item) => ({
        ownerId: item.ownerId,
        name: item.reviewer.name,
      })),
      ...dailyNotes.map((item) => ({
        ownerId: item.ownerId,
        name: item.author.nickname,
      })),
    ]);

    return likes.flatMap((like) => {
      if (like.targetType === "community_b_talk") {
        const recipe = recipeById.get(like.targetId);
        if (!recipe) return [];
        return {
          id: recipe.id,
          kind: "recipe",
          category: "B-TALK",
          date: formatDate(like.createdAt),
          title: recipe.title,
          excerpt: recipe.note,
          author:
            resolveAuthorName(authorProfileLookup, {
              ownerId: recipe.ownerId,
              name: recipe.author.name,
            }) ?? recipe.author.name,
          imageUrl: recipe.processImages[0] ?? recipe.coverUrl,
          viewCount: recipe.viewCount,
          commentCount: recipe.commentCount ?? recipe.comments?.length ?? 0,
          likeCount: recipe.likes,
          href: `/community/b-talk/${recipe.id.replace(/^recipe-/, "b-talk-")}`,
          liked: true,
        };
      }

      if (like.targetType === "community_qa") {
        const post = qaById.get(like.targetId);
        if (!post) return [];
        return {
          id: post.id,
          kind: "post",
          category: "Q&A",
          date: formatDate(like.createdAt),
          title: post.title,
          excerpt: post.body,
          author:
            resolveAuthorName(authorProfileLookup, {
              ownerId: post.ownerId,
              name: post.authorName,
            }) ?? post.authorName,
          imageUrl: post.imageUrls?.[0] ?? post.imageUrl,
          viewCount: post.viewCount,
          commentCount: post.commentCount,
          likeCount: post.likes,
          href: `/community/qa/${post.id}`,
          liked: true,
        };
      }

      if (like.targetType === "community_review") {
        const review = reviewById.get(like.targetId);
        if (!review) return [];
        return {
          id: review.id,
          kind: "review",
          category: "이벤트 리뷰",
          date: formatDate(like.createdAt),
          title: review.title,
          excerpt: review.body,
          author:
            resolveAuthorName(authorProfileLookup, {
              ownerId: review.ownerId,
              name: review.author.name,
            }) ?? review.author.name,
          imageUrl: review.imageUrls[0],
          likeCount: review.likes,
          href: `/community/reviews/${review.id}`,
          liked: true,
        };
      }

      if (like.targetType === "partner_review") {
        const review = partnerReviewById.get(like.targetId);
        if (!review) return [];
        return {
          id: review.id,
          kind: "review",
          category: "리뷰관",
          date: formatDate(like.createdAt),
          title: review.productName,
          excerpt: review.summary,
          author:
            resolveAuthorName(authorProfileLookup, {
              ownerId: review.ownerId,
              name: review.reviewer.name,
            }) ?? review.reviewer.name,
          imageUrl: review.imageUrls[0],
          viewCount: review.viewCount,
          likeCount: review.likes,
          href: `/partner/reviews/${review.id}`,
          liked: true,
        };
      }

      if (like.targetType === "community_daily_note") {
        const note = dailyNoteById.get(like.targetId);
        if (!note) return [];
        const authorName =
          resolveAuthorName(authorProfileLookup, {
            ownerId: note.ownerId,
            name: note.author.nickname,
          }) ?? note.author.nickname;
        const excerpt = note.note?.trim() || "STORY";
        return {
          id: note.id,
          kind: "post",
          category: "STORY",
          date: formatDate(like.createdAt),
          title: note.note?.trim() || `${authorName}님의 STORY`,
          excerpt,
          author: authorName,
          imageUrl: note.imageUrls?.[0],
          commentCount: note.commentCount ?? note.comments?.length ?? 0,
          likeCount: note.likeCount,
          href: `/community/daily-note/${note.id}`,
          liked: true,
        };
      }

      const promotion = promotionById.get(like.targetId);
      if (!promotion) return [];
      return {
        id: promotion.id,
        kind: "promotion",
        category: "홍보관",
        date: formatDate(like.createdAt),
        title: promotion.title,
        excerpt: promotion.summary,
        author:
          resolveAuthorName(authorProfileLookup, {
            ownerId: promotion.ownerId,
            name: promotion.authorName,
          }) ?? promotion.authorName,
        imageUrl: promotion.thumbnailUrl,
        viewCount: promotion.viewCount,
        likeCount: promotion.likes,
        href: `/partner/promotions/${promotion.id}`,
        liked: true,
      };
    });
  }

  private async getActivities(scopedFilter: { ownerId?: string }) {
    const db = await getMongoDb();
    const activities = await db
      .collection<MyActivityItem & { ownerId?: string; deletedAt?: string }>(
        "member_activities",
      )
      .find({ ...scopedFilter, deletedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .toArray();

    if (activities.length === 0) return activities;

    const idsByBoard = activities.reduce<
      Record<MyActivityItem["board"], string[]>
    >(
      (groups, activity) => {
        groups[activity.board].push(
          activityTargetId(activity.board, activity.href),
        );
        return groups;
      },
      { "Event Review": [], "Q&A": [], Recipe: [] },
    );

    const [recipes, qaPosts, reviews] = await Promise.all([
      db
        .collection<Recipe>("community_b_talk")
        .find({
          $and: [{ id: { $in: idsByBoard.Recipe } }, publicContentFilter],
        })
        .project<
          Pick<
            Recipe,
            | "id"
            | "coverUrl"
            | "processImages"
            | "viewCount"
            | "commentCount"
            | "comments"
            | "likes"
          >
        >({
          id: 1,
          coverUrl: 1,
          processImages: 1,
          viewCount: 1,
          commentCount: 1,
          comments: 1,
          likes: 1,
        })
        .toArray(),
      db
        .collection<QaPost>("community_qa_posts")
        .find({
          $and: [{ id: { $in: idsByBoard["Q&A"] } }, publicContentFilter],
        })
        .project<
          Pick<
            QaPost,
            | "id"
            | "imageUrl"
            | "imageUrls"
            | "viewCount"
            | "commentCount"
            | "likes"
          >
        >({
          id: 1,
          imageUrl: 1,
          imageUrls: 1,
          viewCount: 1,
          commentCount: 1,
          likes: 1,
        })
        .toArray(),
      db
        .collection<EventReview>("community_reviews")
        .find({
          $and: [
            { id: { $in: idsByBoard["Event Review"] } },
            publicContentFilter,
          ],
        })
        .project<Pick<EventReview, "id" | "imageUrls">>({
          id: 1,
          imageUrls: 1,
        })
        .toArray(),
    ]);

    const detailsByHref = new Map<
      string,
      Partial<
        Pick<
          MyActivityItem,
          "imageUrl" | "viewCount" | "commentCount" | "likeCount"
        >
      >
    >([
      ...recipes.map(
        (recipe) =>
          [
            `/community/b-talk/${recipe.id.replace(/^recipe-/, "b-talk-")}`,
            {
              imageUrl: recipe.processImages[0] ?? recipe.coverUrl,
              viewCount: recipe.viewCount,
              commentCount: recipe.commentCount ?? recipe.comments?.length ?? 0,
              likeCount: recipe.likes,
            },
          ] as const,
      ),
      ...qaPosts.map(
        (post) =>
          [
            `/community/qa/${post.id}`,
            {
              imageUrl: post.imageUrls?.[0] ?? post.imageUrl,
              viewCount: post.viewCount,
              commentCount: post.commentCount,
              likeCount: post.likes,
            },
          ] as const,
      ),
      ...reviews.map(
        (review) =>
          [
            `/community/reviews/${review.id}`,
            { imageUrl: review.imageUrls[0] },
          ] as const,
      ),
    ]);

    return activities.flatMap((activity) => {
      const details = detailsByHref.get(activity.href);
      if (!details) return [];
      return [
        {
          ...activity,
          ...details,
          imageUrl: activity.imageUrl ?? details?.imageUrl,
          commentCount: details?.commentCount ?? activity.commentCount,
          likeCount: details?.likeCount ?? activity.likeCount,
        },
      ];
    });
  }
}

function accountInfoFromUser(user: UserDocument | null): MemberAccountInfo {
  const socialEmail = user?.socialAccounts.find(
    (account) => account.email,
  )?.email;

  return {
    email: user?.email ?? socialEmail,
    phone: user?.phone,
    country: "대한민국",
    identityVerified: Boolean(user?.phone),
  };
}

export function interestSourceFilter(
  sourceIds: string[],
  blockedOwnerIds: string[],
) {
  return {
    $and: [
      { id: { $in: sourceIds } },
      publicContentFilter,
      blockedOwnerFilter(blockedOwnerIds),
    ],
  };
}

function groupLikeIds(likes: ContentLikeDocument[]) {
  return likes.reduce<Record<LikeTargetType, string[]>>(
    (groups, like) => {
      groups[like.targetType].push(like.targetId);
      return groups;
    },
    {
      community_b_talk: [],
      community_qa: [],
      community_review: [],
      partner_promotion: [],
      partner_review: [],
      community_daily_note: [],
    },
  );
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function activityTargetId(board: MyActivityItem["board"], href: string) {
  const id = href.split("/").pop() ?? "";
  return board === "Recipe" ? id.replace(/^b-talk-/, "recipe-") : id;
}

export function profileWithUserDefaults<T extends MemberProfile>(
  profile: (T & { ownerId?: string }) | null,
  user: Pick<UserDocument, "role" | "avatarUrl"> | null,
): (T & { ownerId?: string }) | null {
  if (!profile || !user) return profile;
  return {
    ...profile,
    role: user.role,
    avatarUrl: profile.avatarUrl ?? user.avatarUrl,
  };
}

export function profileFromUser(
  user: UserDocument,
): MemberProfile & { ownerId: string } {
  const handle = user.handle || user.phone || user.name;

  return {
    ownerId: user.id,
    id: user.id,
    name: user.name,
    handle,
    role: user.role,
    avatarUrl: user.avatarUrl,
    online: true,
    status: "guest",
    workplace: "",
    workplaces: user.workplaces,
    workplaceLocations: user.workplaceLocations,
    specialties: user.specialties,
    bio: "",
    favoriteCount: 0,
    isPortfolioPublic: true,
    certificateName: "",
    officialBadges: [],
    baristaProfile: undefined,
    isOwnProfile: true,
    socials: user.socials,
  };
}

function favoriteProfileFromMember({
  profile,
  user,
  profileId,
  favorited,
}: {
  profile?: MemberProfile;
  user?: UserDocument;
  profileId: string;
  favorited: boolean;
}): FavoriteProfile {
  return {
    id: profileId,
    name: profile?.name ?? user?.name ?? "이름 없음",
    role: profile?.role ?? user?.role,
    specialties: profile?.specialties ?? user?.specialties ?? [],
    bio: profile?.bio ?? "",
    avatarUrl: profile?.avatarUrl ?? user?.avatarUrl,
    favorited,
  };
}

export function createGuestProfile(): MemberProfile {
  return {
    id: "guest",
    name: "게스트",
    handle: "guest",
    role: "enthusiast",
    online: false,
    status: "guest",
    workplace: "",
    workplaces: [],
    workplaceLocations: [],
    specialties: [],
    bio: "",
    favoriteCount: 0,
    isPortfolioPublic: false,
    certificateName: "",
    officialBadges: [],
    baristaProfile: undefined,
    isOwnProfile: false,
    socials: emptySocials,
  };
}

export type MemberProfilePatch = Partial<{
  name: string;
  handle: string;
  role: PublicMemberRole;
  avatarUrl: string;
  status: StatusMessage;
  workplace: string;
  workplaces: string[];
  workplaceLocations: WorkplaceLocation[];
  specialties: string[];
  bio: string;
  activityRegion: string;
  isPortfolioPublic: boolean;
  certificateName: string;
  baristaProfile: BaristaProfileDetails;
  socials: SocialLinks;
}>;
