import { getMongoDb } from "@/infrastructure/mongodb/client";
import { ensurePassportIndexes } from "@/infrastructure/mongodb/passportIndexes";

let ensured = false;
const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;

export async function ensureMongoIndexes() {
  if (ensured) return;

  const db = await getMongoDb();
  const users = db.collection("users");
  const auditLogs = db.collection("admin_audit_logs");
  const adminLoginAttempts = db.collection("admin_login_attempts");
  const deletionJobs = db.collection("account_deletion_jobs");
  const searchDocuments = db.collection("search_documents");
  const searchIndexRuns = db.collection("search_index_runs");
  const contentCollections = [
    "community_events",
    "community_reviews",
    "community_b_talk",
    "community_daily_notes",
    "community_qa_posts",
    "partner_promotions",
    "partner_reviews",
    "partner_banners",
  ];

  await Promise.all([
    deletionJobs.createIndex({ userId: 1 }, { unique: true }),
    deletionJobs.createIndex({ status: 1, nextAttemptAt: 1 }),
    deletionJobs.createIndex({ status: 1, leaseExpiresAt: 1 }),
    deletionJobs.createIndex({ deadlineAt: 1 }),
    db
      .collection("content_notices")
      .createIndex({ id: 1 }, { unique: true, name: "content_notices_id" }),
    db
      .collection("content_notices")
      .createIndex(
        { status: 1, deletedAt: 1, publishedAt: -1, id: -1 },
        { name: "content_notices_public_recent" },
      ),
    db
      .collection("content_notices")
      .createIndex(
        { title: "text", body: "text" },
        { name: "content_notices_text", default_language: "none" },
      ),
    db
      .collection("content_faqs")
      .createIndex({ id: 1 }, { unique: true, name: "content_faqs_id" }),
    db
      .collection("content_faqs")
      .createIndex(
        { status: 1, deletedAt: 1, sortOrder: 1, id: 1 },
        { name: "content_faqs_public_order" },
      ),
    db
      .collection("content_faqs")
      .createIndex(
        { question: "text", answer: "text" },
        { name: "content_faqs_text", default_language: "none" },
      ),
    db
      .collection("content_policies")
      .createIndex({ id: 1 }, { unique: true, name: "content_policies_id" }),
    db
      .collection("content_policies")
      .createIndex(
        { slug: 1, version: -1 },
        { unique: true, name: "content_policies_slug_version" },
      ),
    db
      .collection("content_policies")
      .createIndex(
        { status: 1, deletedAt: 1, slug: 1, effectiveAt: -1 },
        { name: "content_policies_public_version" },
      ),
    db
      .collection("content_policies")
      .createIndex(
        { title: "text", body: "text" },
        { name: "content_policies_text", default_language: "none" },
      ),
    ...contentCollections.map((name) =>
      db
        .collection(name)
        .createIndex(
          { moderationStatus: 1, updatedAt: -1, id: -1 },
          { name: "admin_content_lifecycle_recent" },
        ),
    ),
    db
      .collection("community_event_requests")
      .createIndex({ id: 1 }, { unique: true, name: "event_requests_id" }),
    db
      .collection("community_event_requests")
      .createIndex(
        { status: 1, createdAt: -1 },
        { name: "event_requests_status_recent" },
      ),
    db
      .collection("reports")
      .createIndex({ id: 1 }, { unique: true, name: "reports_id" }),
    db.collection("reports").createIndex(
      {
        reporterId: 1,
        targetType: 1,
        targetId: 1,
        parentId: 1,
        activeKey: 1,
      },
      { unique: true, sparse: true, name: "reports_one_open_target" },
    ),
    db
      .collection("reports")
      .createIndex(
        { status: 1, createdAt: -1, id: -1 },
        { name: "reports_status_recent" },
      ),
    db
      .collection("report_daily_quotas")
      .createIndex(
        { reporterId: 1, day: 1 },
        { unique: true, name: "report_daily_quota" },
      ),
    db
      .collection("report_daily_quotas")
      .createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: "report_daily_quota_expiry" },
      ),
    db
      .collection("user_blocks")
      .createIndex(
        { blockerId: 1, blockedId: 1 },
        { unique: true, name: "user_blocks_unique_pair" },
      ),
    db
      .collection("user_blocks")
      .createIndex({ blockerId: 1 }, { name: "user_blocks_by_blocker" }),
    db
      .collection("user_sanctions")
      .createIndex({ id: 1 }, { unique: true, name: "sanctions_id" }),
    db
      .collection("user_sanctions")
      .createIndex(
        { userId: 1, revokedAt: 1, endsAt: 1 },
        { name: "sanctions_user_active" },
      ),
    db
      .collection("community_events")
      .createIndex(
        { requestId: 1 },
        { unique: true, sparse: true, name: "events_request_unique" },
      ),
    db
      .collection("partner_banners")
      .createIndex(
        { moderationStatus: 1, activeFrom: 1, activeTo: 1, sortOrder: 1 },
        { name: "partner_banners_public_schedule" },
      ),
    searchDocuments.createIndex(
      { createdAt: -1, visibility: 1 },
      { name: "dashboard_content_created" },
    ),
    users.createIndex(
      { createdAt: -1, accountStatus: 1 },
      { name: "dashboard_users_created" },
    ),
    users.createIndex(
      { updatedAt: -1, accountStatus: 1 },
      { name: "dashboard_users_updated" },
    ),
    users.createIndex(
      { role: 1, accountStatus: 1, createdAt: -1, id: -1 },
      { name: "admin_users_role_status_recent" },
    ),
    users.createIndex(
      { lastLoginMethod: 1, lastLoginAt: -1, id: -1 },
      { name: "admin_users_login_recent" },
    ),
    users.createIndex(
      { lastSeenAt: -1, id: -1 },
      { name: "users_last_seen_recent", sparse: true },
    ),
    users.createIndex({ email: 1 }, { unique: true, sparse: true }),
    db
      .collection("app_configs")
      .createIndex(
        { key: 1 },
        { unique: true, name: "app_configs_key_unique" },
      ),
    db
      .collection("app_popups")
      .createIndex({ id: 1 }, { unique: true, name: "app_popups_id" }),
    db
      .collection("app_popups")
      .createIndex(
        { enabled: 1, startsAt: 1, endsAt: 1, placements: 1, priority: 1 },
        { name: "app_popups_active_schedule" },
      ),
    db
      .collection("member_profile_badges")
      .createIndex(
        { id: 1 },
        { unique: true, name: "member_profile_badges_id" },
      ),
    db
      .collection("member_profile_badges")
      .createIndex(
        { name: 1 },
        { unique: true, name: "member_profile_badges_name" },
      ),
    db
      .collection("member_profile_badges")
      .createIndex(
        { sortOrder: 1, name: 1 },
        { name: "member_profile_badges_order" },
      ),
    db.collection("member_profile_badge_assignments").createIndex(
      { ownerId: 1, badgeId: 1 },
      {
        unique: true,
        name: "member_profile_badge_assignments_owner_badge",
      },
    ),
    db
      .collection("member_profile_badge_assignments")
      .createIndex(
        { badgeId: 1 },
        { name: "member_profile_badge_assignments_badge" },
      ),
    db
      .collection("phone_verifications")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("phone_verifications").createIndex({ phone: 1 }),
    db
      .collection("pending_social_signups")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db
      .collection("pending_social_signups")
      .createIndex({ token: 1 }, { unique: true }),
    db
      .collection("auth_recent_logins")
      .createIndex({ deviceId: 1 }, { unique: true }),
    db.collection("auth_recent_logins").createIndex({ updatedAt: -1 }),
    db
      .collection("auth_recent_logins")
      .createIndex(
        { userId: 1, updatedAt: -1 },
        { name: "auth_recent_logins_user_recent" },
      ),
    users.createIndex({ id: 1 }, { unique: true, name: "users_id_unique" }),
    users.createIndex({ phone: 1 }, { unique: true, sparse: true }),
    users.createIndex(
      {
        "socialAccounts.provider": 1,
        "socialAccounts.providerId": 1,
      },
      {
        unique: true,
        name: "users_social_account_unique",
        partialFilterExpression: {
          "socialAccounts.provider": { $exists: true },
          "socialAccounts.providerId": { $exists: true },
        },
      },
    ),
    db
      .collection("member_profiles")
      .createIndex({ ownerId: 1 }, { unique: true, sparse: true }),
    db.collection("member_careers").createIndex(
      {
        ownerId: 1,
        year: -1,
      },
      { name: "member_careers_owner_year" },
    ),
    db.collection("member_portfolios").createIndex(
      {
        ownerId: 1,
        createdAt: -1,
      },
      { name: "member_portfolios_owner_recent" },
    ),
    db.collection("member_notifications").createIndex(
      {
        ownerId: 1,
        _createdAt: -1,
        id: -1,
      },
      { name: "member_notifications_owner_created_recent" },
    ),
    db.collection("member_notifications").createIndex(
      { _createdAt: 1 },
      {
        expireAfterSeconds: THIRTY_DAYS_IN_SECONDS,
        name: "member_notifications_expire_after_30_days",
      },
    ),
    db
      .collection("member_messages")
      .createIndex({ id: 1 }, { unique: true, name: "member_messages_id" }),
    db.collection("member_messages").createIndex(
      {
        recipientId: 1,
        read: 1,
        createdAt: -1,
      },
      { name: "member_messages_recipient_unread_recent" },
    ),
    db.collection("member_messages").createIndex(
      {
        senderId: 1,
        createdAt: -1,
      },
      { name: "member_messages_sender_recent" },
    ),
    db.collection("member_chat_rooms").createIndex(
      {
        ownerId: 1,
        counterpartId: 1,
      },
      { unique: true, name: "member_chat_rooms_owner_counterpart" },
    ),
    db
      .collection("member_favorites")
      .createIndex({ ownerId: 1 }, { name: "member_favorites_owner" }),
    db.collection("member_favorites").createIndex(
      {
        ownerId: 1,
        id: 1,
      },
      { name: "member_favorites_owner_profile" },
    ),
    db.collection("member_recipes").createIndex(
      {
        ownerId: 1,
        createdAt: -1,
      },
      { name: "member_recipes_owner_recent" },
    ),
    db.collection("member_activities").createIndex(
      {
        ownerId: 1,
        createdAt: -1,
      },
      { name: "member_activities_owner_recent" },
    ),
    db
      .collection("member_notification_settings")
      .createIndex({ ownerId: 1 }, { unique: true }),
    db
      .collection("member_push_tokens")
      .createIndex({ token: 1 }, { unique: true, name: "push_token_unique" }),
    db.collection("member_push_tokens").createIndex(
      {
        ownerId: 1,
        disabled: 1,
        updatedAt: -1,
      },
      { name: "push_tokens_owner_active" },
    ),
    db.collection("content_likes").createIndex(
      {
        targetType: 1,
        targetId: 1,
        identityKey: 1,
      },
      { unique: true, name: "content_like_identity_unique" },
    ),
    db
      .collection("content_likes")
      .createIndex(
        { targetType: 1, targetId: 1, createdAt: -1, _id: -1 },
        { name: "admin_content_reactions_recent" },
      ),
    db
      .collection("community_events")
      .createIndex({ id: 1 }, { name: "community_events_id" }),
    db.collection("content_likes").createIndex(
      {
        identityKey: 1,
        targetType: 1,
        createdAt: -1,
      },
      { name: "content_likes_identity_type_recent" },
    ),
    db
      .collection("community_events")
      .createIndex({ startsAt: 1 }, { name: "community_events_starts_at" }),
    db
      .collection("community_reviews")
      .createIndex({ createdAt: -1 }, { name: "community_reviews_recent" }),
    db
      .collection("community_reviews")
      .createIndex({ id: 1 }, { name: "community_reviews_id" }),
    db
      .collection("community_b_talk")
      .createIndex({ id: 1 }, { name: "community_b_talk_id" }),
    db
      .collection("community_daily_notes")
      .createIndex(
        { id: 1 },
        { unique: true, name: "community_daily_notes_id" },
      ),
    db
      .collection("community_daily_notes")
      .createIndex(
        { createdAt: -1, id: -1 },
        { name: "community_daily_notes_recent" },
      ),
    db
      .collection("community_qa_posts")
      .createIndex({ createdAt: -1 }, { name: "community_qa_posts_recent" }),
    db
      .collection("community_qa_posts")
      .createIndex({ id: 1 }, { name: "community_qa_posts_id" }),
    db
      .collection("partner_banners")
      .createIndex({ id: 1 }, { name: "partner_banners_id" }),
    db
      .collection("partner_promotions")
      .createIndex({ createdAt: -1 }, { name: "partner_promotions_recent" }),
    db
      .collection("partner_promotions")
      .createIndex({ id: 1 }, { name: "partner_promotions_id" }),
    db
      .collection("partner_reviews")
      .createIndex({ createdAt: -1 }, { name: "partner_reviews_recent" }),
    db
      .collection("partner_reviews")
      .createIndex({ id: 1 }, { name: "partner_reviews_id" }),
    db
      .collection("search_documents")
      .createIndex({ id: 1 }, { unique: true, name: "search_document_id" }),
    db
      .collection("search_documents")
      .createIndex(
        { visibility: 1, sourceType: 1, updatedAt: -1 },
        { name: "search_public_type_recent" },
      ),
    searchIndexRuns.createIndex(
      { status: 1 },
      {
        unique: true,
        partialFilterExpression: { status: "running" },
        name: "search_index_one_running",
      },
    ),
    searchIndexRuns.createIndex(
      { startedAt: -1 },
      { name: "search_index_runs_recent" },
    ),
    db.collection("search_documents").createIndex(
      {
        title: "text",
        body: "text",
        keywords: "text",
        category: "text",
        authorName: "text",
      },
      {
        name: "search_public_text",
        default_language: "none",
        weights: {
          title: 10,
          keywords: 5,
          category: 3,
          authorName: 2,
          body: 1,
        },
      },
    ),
    db
      .collection("search_documents")
      .createIndex(
        { sourceType: 1, sourceId: 1 },
        { unique: true, name: "search_source_unique" },
      ),
    auditLogs.createIndex(
      { id: 1 },
      { unique: true, name: "admin_audit_logs_id" },
    ),
    auditLogs.createIndex(
      { createdAt: -1, id: -1 },
      { name: "admin_audit_logs_recent" },
    ),
    auditLogs.createIndex(
      { actorId: 1, createdAt: -1 },
      { name: "admin_audit_logs_actor_recent" },
    ),
    auditLogs.createIndex(
      { resourceType: 1, resourceId: 1, createdAt: -1 },
      { name: "admin_audit_logs_resource_recent" },
    ),
    adminLoginAttempts.createIndex(
      { key: 1 },
      { unique: true, name: "admin_login_attempts_key" },
    ),
    adminLoginAttempts.createIndex(
      { expiresAt: 1 },
      {
        expireAfterSeconds: 0,
        name: "admin_login_attempts_expiry",
      },
    ),
    db
      .collection("barista_showrooms")
      .createIndex({ id: 1 }, { unique: true, name: "barista_showrooms_id" }),
    db
      .collection("barista_showrooms")
      .createIndex(
        { userId: 1 },
        { unique: true, name: "barista_showrooms_user" },
      ),
    db
      .collection("barista_showrooms")
      .createIndex({ createdAt: -1 }, { name: "barista_showrooms_recent" }),
    db
      .collection("menus")
      .createIndex({ id: 1 }, { unique: true, name: "menus_id" }),
    db
      .collection("menus")
      .createIndex(
        { baristaId: 1, createdAt: -1 },
        { name: "menus_barista_recent" },
      ),
    db
      .collection("menus")
      .createIndex(
        { showroomId: 1, createdAt: -1 },
        { name: "menus_showroom_recent" },
      ),
    db
      .collection("coupons")
      .createIndex({ id: 1 }, { unique: true, name: "coupons_id" }),
    db
      .collection("coupons")
      .createIndex(
        { baristaId: 1, validUntil: -1 },
        { name: "coupons_barista_valid" },
      ),
    db
      .collection("coupons")
      .createIndex(
        { showroomId: 1, validUntil: -1 },
        { name: "coupons_showroom_valid" },
      ),
    db
      .collection("coupons")
      .createIndex(
        { couponType: 1, validUntil: -1 },
        { name: "coupons_type_valid" },
      ),
    db
      .collection("coupon_store_staff")
      .createIndex({ userId: 1, active: 1 }, { name: "coupon_staff_user" }),
    db
      .collection("coupon_store_staff")
      .createIndex(
        { storeId: 1, grantedBy: 1, active: 1 },
        { name: "coupon_staff_store" },
      ),
    db
      .collection("user_coupons")
      .createIndex({ id: 1 }, { unique: true, name: "user_coupons_id" }),
    db
      .collection("user_coupons")
      .createIndex(
        { userId: 1, couponId: 1, claimRequestId: 1 },
        { unique: true, name: "user_coupons_claim_request" },
      ),
    db
      .collection("user_coupons")
      .createIndex(
        { userId: 1, status: 1, createdAt: -1 },
        { name: "user_coupons_user_status" },
      ),
    db
      .collection("member_last_locations")
      .createIndex(
        { userId: 1 },
        { unique: true, name: "member_last_locations_user" },
      ),
    db
      .collection("member_last_locations")
      .createIndex(
        { location: "2dsphere" },
        { name: "member_last_locations_geo" },
      ),
    db
      .collection("member_last_locations")
      .createIndex(
        { updatedAt: -1 },
        { name: "member_last_locations_updated" },
      ),
    db
      .collection("store_favorites")
      .createIndex(
        { ownerId: 1, storeId: 1 },
        { unique: true, name: "store_favorites_owner_store" },
      ),
    db
      .collection("store_favorites")
      .createIndex(
        { ownerId: 1, createdAt: -1 },
        { name: "store_favorites_owner_recent" },
      ),
    db
      .collection("store_favorites")
      .createIndex({ storeId: 1 }, { name: "store_favorites_store" }),
    ensurePassportIndexes(db),
  ]);

  ensured = true;
}
