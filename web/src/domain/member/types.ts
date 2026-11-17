import type { OfficialProfileBadge } from "@blending/admin-contracts";
import type { CoffeePassport } from "../passport/passport";

export type { OfficialProfileBadge };

export type PublicMemberRole = "barista" | "enthusiast" | "partner";
export type MemberRole = PublicMemberRole | "admin";

export type StatusMessage = "guest" | "job-seeking" | "focused";

export type SocialLinks = {
  instagram: string;
  threads: string;
  website: string;
  recipeUrl: string;
};

export type WorkplaceLocation = {
  id: string;
  name: string;
  address: string;
  postalCode?: string;
  detailAddress?: string;
  employmentTypes?: string[];
  lat: number;
  lng: number;
  displayName: string;
};

export type BaristaProfileDetails = {
  contactPhone: string;
  employmentTypes: string[];
  totalExperience: string;
  certificateFileUrls: string[];
  espressoMachineBrands: string[];
  espressoMachineBrandOther: string;
  grinderBrands: string[];
  grinderBrandOther: string;
  roasterBrands: string[];
  roasterBrandOther: string;
  preferredBeans: string;
  preferredBeanNotes: string[];
};

export type MemberProfile = {
  id: string;
  name: string;
  handle: string;
  role: MemberRole;
  avatarUrl?: string;
  online: boolean;
  status: StatusMessage;
  workplace: string;
  workplaces: string[];
  workplaceLocations?: WorkplaceLocation[];
  specialties: string[];
  bio: string;
  activityRegion?: string;
  favoriteCount: number;
  isPortfolioPublic: boolean;
  certificateName: string;
  officialBadges: OfficialProfileBadge[];
  baristaProfile?: BaristaProfileDetails;
  passport?: CoffeePassport;
  passportSummary?: { balance: number; totalStamps: number };
  isOwnProfile: boolean;
  socials: SocialLinks;
};

export type MemberAccountInfo = {
  email?: string;
  phone?: string;
  country: string;
  identityVerified: boolean;
};

export type CareerItem = {
  id: string;
  type: "career" | "award";
  year: string;
  period: string;
  title: string;
  organization?: string;
  detail?: string;
  description?: string;
  current?: boolean;
};

export type PortfolioItem = {
  id: string;
  title: string;
  createdAt: string;
  summary: string;
  imageUrls: string[];
};

export type NotificationItem = {
  id: string;
  kind: "comment" | "like" | "message" | "notice" | "reservation";
  title: string;
  createdAgo: string;
  unread: boolean;
  href?: string;
};

export type DirectMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string;
  recipientId: string;
  recipientName: string;
  recipientAvatarUrl?: string;
  body: string;
  imageUrls?: string[];
  read: boolean;
  createdAt: string;
};

export type DirectChatRoomSetting = {
  counterpartId: string;
  blocked: boolean;
  muted: boolean;
  leftAt?: string;
};

export type NotificationSettingKey =
  | "communityLikes"
  | "communityComments"
  | "communityReplies"
  | "interestActivity"
  | "eventUpdates"
  | "directMessage"
  | "accountSecurity"
  | "benefitsMarketing"
  | "nightNotifications"
  | "shareLocationForTimesale";

export type NotificationSettings = Record<NotificationSettingKey, boolean>;

export const defaultNotificationSettings: NotificationSettings = {
  communityLikes: true,
  communityComments: true,
  communityReplies: true,
  interestActivity: true,
  eventUpdates: true,
  directMessage: true,
  accountSecurity: true,
  benefitsMarketing: false,
  nightNotifications: false,
  shareLocationForTimesale: false,
};

export type FavoriteProfile = {
  id: string;
  name: string;
  role?: MemberRole;
  specialties: string[];
  bio: string;
  avatarUrl?: string;
  favorited: boolean;
};

export type MyRecipe = {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  imageUrl?: string;
  href?: string;
  liked: boolean;
};

export type MyActivityItem = {
  id: string;
  kind: "post" | "comment";
  board: "Q&A" | "Recipe" | "Event Review";
  title: string;
  excerpt: string;
  createdAt: string;
  imageUrl?: string;
  viewCount?: number;
  commentCount?: number;
  likeCount?: number;
  href: string;
};

export type MemberInterestItem = {
  id: string;
  kind: "post" | "recipe" | "promotion" | "review";
  category: string;
  date: string;
  title: string;
  excerpt: string;
  author: string;
  imageUrl?: string;
  viewCount?: number;
  commentCount?: number;
  likeCount?: number;
  href: string;
  liked: boolean;
};

export type MemberSnapshot = {
  profile: MemberProfile;
  account: MemberAccountInfo;
  careers: CareerItem[];
  portfolios: PortfolioItem[];
  notifications: NotificationItem[];
  messages: DirectMessage[];
  chatRoomSettings: DirectChatRoomSetting[];
  notificationSettings: NotificationSettings;
  favorites: FavoriteProfile[];
  favoriteFollowers: FavoriteProfile[];
  recipes: MyRecipe[];
  myActivities: MyActivityItem[];
  interests: MemberInterestItem[];
};

export type MemberRepository = {
  getSnapshot: () => Promise<MemberSnapshot>;
};
