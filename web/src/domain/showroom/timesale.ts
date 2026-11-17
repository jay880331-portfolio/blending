import { createRequire } from "node:module";
import type {
  BaristaShowroom,
  ShowroomCoupon,
  ShowroomLocation,
} from "./types";
import {
  canWriteShowroom,
  showroomLoginRequiredMessage,
  showroomWriteForbiddenMessage,
} from "./access";
import {
  matchingWorkplaceId,
  showroomLocationFromWorkplace,
  workplaceFullAddress,
} from "./fromWorkplace";

export {
  canWriteShowroom,
  showroomLoginRequiredMessage,
  showroomWriteForbiddenMessage,
};

const EARTH_RADIUS_KM = 6371;
export const TIMESALE_RADIUS_KM = 3;
export const TIMESALE_LOCATION_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
export const TIMESALE_RESEND_COOLDOWN_MS = 60 * 60 * 1_000;

export type NearbyLocationCandidate = {
  userId: string;
  latitude: number;
  longitude: number;
  updatedAt: Date;
  shareLocationForTimesale: boolean;
};

export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function isLocationFresh(
  updatedAt: Date,
  now: Date,
  maxAgeMs = TIMESALE_LOCATION_MAX_AGE_MS,
) {
  return now.getTime() - updatedAt.getTime() <= maxAgeMs;
}

export function isTimesaleResendConflict(
  lastPushedAt: string | undefined,
  now = new Date(),
  cooldownMs = TIMESALE_RESEND_COOLDOWN_MS,
) {
  if (!lastPushedAt) return false;
  return now.getTime() - new Date(lastPushedAt).getTime() < cooldownMs;
}

export function timesalePushHref(showroomId: string, couponId: string) {
  return `/showroom/${showroomId}?coupon=${couponId}`;
}

export function timesalePushPayload({
  showroom,
  coupon,
  customTitle,
  customBody,
}: {
  showroom: Pick<BaristaShowroom, "id" | "storeName">;
  coupon: Pick<ShowroomCoupon, "id" | "title" | "discountDetail">;
  customTitle?: string;
  customBody?: string;
}) {
  return {
    title: customTitle?.trim() || `[타임세일] ${showroom.storeName} 깜짝 혜택!`,
    body:
      customBody?.trim() ||
      `${coupon.title} (${coupon.discountDetail}) 지금 쇼룸에서 확인하세요!`,
    data: { href: timesalePushHref(showroom.id, coupon.id) },
  };
}

export function selectTimesaleRecipientUserIds({
  baristaId,
  favoriteOwnerIds,
  nearbyCandidates,
  storeLocation,
  now,
  radiusKm = TIMESALE_RADIUS_KM,
  maxAgeMs = TIMESALE_LOCATION_MAX_AGE_MS,
}: {
  baristaId: string;
  favoriteOwnerIds: string[];
  nearbyCandidates: NearbyLocationCandidate[];
  storeLocation?: ShowroomLocation;
  now: Date;
  radiusKm?: number;
  maxAgeMs?: number;
}) {
  const regularUserIds = favoriteOwnerIds.filter(
    (id) => Boolean(id) && id !== baristaId,
  );
  const nearbyUserIds: string[] = [];

  if (
    storeLocation &&
    typeof storeLocation.latitude === "number" &&
    typeof storeLocation.longitude === "number"
  ) {
    for (const candidate of nearbyCandidates) {
      if (!candidate.shareLocationForTimesale) continue;
      if (candidate.userId === baristaId) continue;
      if (!isLocationFresh(candidate.updatedAt, now, maxAgeMs)) continue;
      const distanceKm = calculateDistanceKm(
        storeLocation.latitude,
        storeLocation.longitude,
        candidate.latitude,
        candidate.longitude,
      );
      if (distanceKm <= radiusKm) nearbyUserIds.push(candidate.userId);
    }
  }

  return Array.from(new Set([...regularUserIds, ...nearbyUserIds])).filter(
    (id) => id !== baristaId,
  );
}

if (process.env.NODE_TEST_CONTEXT) {
  const require = createRequire(import.meta.url);
  const assert: typeof import("node:assert/strict") = require("node:assert/strict");
  const { describe, it } = require("node:test") as typeof import("node:test");
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  const { defaultNotificationSettings } =
    require("../member/types") as typeof import("../member/types");
  const { privateDeletionOperations } =
    require("../../infrastructure/mongodb/accountDeletionMongoRepository") as typeof import("../../infrastructure/mongodb/accountDeletionMongoRepository");

  const STORE = { latitude: 37.5665, longitude: 126.978 };
  const NOW = new Date("2026-09-13T12:00:00.000Z");
  const webRoot = join(process.cwd());

  function nearbyCandidate(
    overrides: Partial<NearbyLocationCandidate> & { userId: string },
  ): NearbyLocationCandidate {
    return {
      latitude: STORE.latitude + 0.01,
      longitude: STORE.longitude,
      updatedAt: new Date("2026-09-13T06:00:00.000Z"),
      shareLocationForTimesale: true,
      ...overrides,
    };
  }

  function readWeb(rel: string) {
    return readFileSync(join(webRoot, rel), "utf8");
  }

  describe("showroom access", () => {
    it("allows barista and admin to write, rejects enthusiast", () => {
      assert.equal(canWriteShowroom("barista"), true);
      assert.equal(canWriteShowroom("admin"), true);
      assert.equal(canWriteShowroom("enthusiast"), false);
      assert.equal(canWriteShowroom(undefined), false);
      assert.equal(
        showroomWriteForbiddenMessage(),
        "바리스타만 쇼룸을 등록·관리할 수 있습니다.",
      );
    });

    it("returns the login-required copy used by APIs", () => {
      assert.equal(showroomLoginRequiredMessage(), "로그인이 필요합니다.");
    });

    it("maps a profile workplace to a showroom store location", () => {
      const workplace = {
        id: "w-1",
        name: "성수 블렌딩",
        address: "서울 성동구 연무장길 12",
        detailAddress: "2층",
        lat: 37.5446,
        lng: 127.056,
        displayName: "성수 블렌딩 · 서울 성동구 연무장길 12",
      };
      assert.equal(
        workplaceFullAddress(workplace),
        "서울 성동구 연무장길 12 2층",
      );
      assert.deepEqual(showroomLocationFromWorkplace(workplace), {
        latitude: 37.5446,
        longitude: 127.056,
        address: "서울 성동구 연무장길 12 2층",
      });
      assert.equal(
        showroomLocationFromWorkplace({ ...workplace, lat: 0, lng: 0 }),
        undefined,
      );
      assert.equal(
        matchingWorkplaceId(
          [workplace, { ...workplace, id: "w-2", name: "다른 매장" }],
          {
            storeName: "성수 블렌딩",
            location: {
              latitude: 37.5446,
              longitude: 127.056,
              address: "서울 성동구 연무장길 12 2층",
            },
          },
        ),
        "w-1",
      );
    });
  });

  describe("timesale geo, cooldown, deeplink", () => {
    it("uses 3km / 24h / 1h constants", () => {
      assert.equal(TIMESALE_RADIUS_KM, 3);
      assert.equal(TIMESALE_LOCATION_MAX_AGE_MS, 24 * 60 * 60 * 1000);
      assert.equal(TIMESALE_RESEND_COOLDOWN_MS, 60 * 60 * 1000);
    });

    it("calculates nearby under 3km and far over 3km", () => {
      assert.equal(
        calculateDistanceKm(
          STORE.latitude,
          STORE.longitude,
          STORE.latitude,
          STORE.longitude,
        ),
        0,
      );
      const nearbyKm = calculateDistanceKm(
        STORE.latitude,
        STORE.longitude,
        STORE.latitude + 0.01,
        STORE.longitude,
      );
      assert.ok(nearbyKm > 0.5 && nearbyKm < 2);
      const farKm = calculateDistanceKm(
        STORE.latitude,
        STORE.longitude,
        STORE.latitude + 0.05,
        STORE.longitude,
      );
      assert.ok(farKm > 3);
    });

    it("treats locations older than 24h as stale", () => {
      assert.equal(
        isLocationFresh(new Date("2026-09-13T00:00:00.000Z"), NOW),
        true,
      );
      assert.equal(
        isLocationFresh(new Date("2026-09-12T11:59:00.000Z"), NOW),
        false,
      );
    });

    it("flags resend inside the 1 hour cooldown as conflict", () => {
      assert.equal(isTimesaleResendConflict(undefined, NOW), false);
      assert.equal(
        isTimesaleResendConflict("2026-09-13T11:10:00.000Z", NOW),
        true,
      );
      assert.equal(
        isTimesaleResendConflict("2026-09-13T10:00:00.000Z", NOW),
        false,
      );
    });

    it("builds Expo data.href as /showroom/{id}?coupon={id}", () => {
      assert.equal(
        timesalePushHref("showroom-1", "coupon-9"),
        "/showroom/showroom-1?coupon=coupon-9",
      );
      const payload = timesalePushPayload({
        showroom: { id: "showroom-1", storeName: "성수 블렌딩" },
        coupon: {
          id: "coupon-9",
          title: "아메리카노 2000원",
          discountDetail: "전 메뉴 2000원",
        },
      });
      assert.deepEqual(payload.data, {
        href: "/showroom/showroom-1?coupon=coupon-9",
      });
    });
  });

  describe("selectTimesaleRecipientUserIds", () => {
    it("falls back to favorites only when the store has no coordinates", () => {
      const ids = selectTimesaleRecipientUserIds({
        baristaId: "barista-1",
        favoriteOwnerIds: ["fan-1", "barista-1", ""],
        nearbyCandidates: [nearbyCandidate({ userId: "near-1" })],
        now: NOW,
      });
      assert.deepEqual(ids, ["fan-1"]);
    });

    it("unions favorites with opt-in, fresh, in-radius neighbors and skips self", () => {
      const ids = selectTimesaleRecipientUserIds({
        baristaId: "barista-1",
        favoriteOwnerIds: ["fan-1", "barista-1"],
        storeLocation: STORE,
        now: NOW,
        nearbyCandidates: [
          nearbyCandidate({ userId: "near-1" }),
          nearbyCandidate({
            userId: "opted-out",
            shareLocationForTimesale: false,
          }),
          nearbyCandidate({
            userId: "stale",
            updatedAt: new Date("2026-09-12T11:00:00.000Z"),
          }),
          nearbyCandidate({
            userId: "far",
            latitude: STORE.latitude + 0.05,
          }),
          nearbyCandidate({ userId: "barista-1" }),
          nearbyCandidate({ userId: "fan-1" }),
        ],
      });
      assert.deepEqual(ids.sort(), ["fan-1", "near-1"]);
    });

    it("does not add neighbors when shareLocationForTimesale is off", () => {
      assert.equal(defaultNotificationSettings.shareLocationForTimesale, false);
      const ids = selectTimesaleRecipientUserIds({
        baristaId: "barista-1",
        favoriteOwnerIds: ["fan-1"],
        storeLocation: STORE,
        now: NOW,
        nearbyCandidates: [
          nearbyCandidate({
            userId: "near-1",
            shareLocationForTimesale: false,
          }),
        ],
      });
      assert.deepEqual(ids, ["fan-1"]);
    });
  });

  describe("showroom MVP source contracts", () => {
    it("requires login on showroom APIs and pages", () => {
      const routes = [
        "app/api/showroom/route.ts",
        "app/api/showroom/[id]/route.ts",
        "app/api/showroom/mine/route.ts",
        "app/api/showroom/menus/route.ts",
        "app/api/showroom/menus/[menuId]/route.ts",
        "app/api/showroom/coupons/route.ts",
        "app/api/showroom/coupons/[couponId]/route.ts",
        "app/api/showroom/coupons/[couponId]/claim/route.ts",
        "app/api/showroom/coupons/[couponId]/timesale-push/route.ts",
        "app/api/showroom/user-coupons/route.ts",
        "app/api/showroom/user-coupons/[userCouponId]/use/route.ts",
        "app/api/member/last-location/route.ts",
      ];
      for (const rel of routes) {
        assert.match(
          readWeb(rel),
          /if \(!user\) return jsonError\("로그인이 필요합니다\.", 401\);/,
        );
      }
      for (const rel of [
        "app/showroom/page.tsx",
        "app/showroom/[id]/page.tsx",
        "app/showroom/coupons/page.tsx",
        "app/showroom/manage/page.tsx",
      ]) {
        assert.match(readWeb(rel), /requireAuthenticatedPage/);
      }
    });

    it("keeps BottomNav at 5 slots with a partner tab", () => {
      const source = readWeb("src/ui/shared/BottomNav.tsx");
      assert.match(source, /grid-cols-5/);
      assert.match(
        source,
        /type BottomNavKey = "map" \| "community" \| "home" \| "partner" \| "mypage"/,
      );
      assert.equal((source.match(/href: "/g) ?? []).length, 5);
      assert.match(source, /href: "\/partner\/promotions"/);
      assert.match(source, /icon: "local_cafe"/);
      assert.doesNotMatch(source, /href: "\/showroom"/);
    });

    it("attaches showroom BottomNav, shared tabs, and map location updates", () => {
      for (const rel of [
        "src/ui/showroom/ShowroomListApp.tsx",
        "src/ui/showroom/ShowroomDetailApp.tsx",
      ]) {
        assert.match(readWeb(rel), /<BottomNav active="map" \/>/);
      }
      for (const rel of [
        "src/ui/showroom/ShowroomManageApp.tsx",
        "src/ui/showroom/UserCouponsApp.tsx",
      ]) {
        assert.match(readWeb(rel), /<BottomNav active="mypage" \/>/);
      }
      assert.match(
        readWeb("src/ui/showroom/ShowroomListApp.tsx"),
        /<TextTabBar/,
      );
      const coupons = readWeb("src/ui/showroom/UserCouponsApp.tsx");
      assert.match(coupons, /<TextTabBar/);
      assert.match(coupons, /<ConfirmDialog/);
      const map = readWeb("src/ui/map/MapApp.tsx");
      assert.match(
        map,
        /import \{ updateLastLocation \} from "@\/adapters\/http\/showroomApi"/,
      );
      assert.match(
        map,
        /void updateLastLocation\(nextLocation\.lat, nextLocation\.lng\)/,
      );
    });

    it("opens from map, community, public profile, and mypage", () => {
      assert.match(
        readWeb("src/ui/map/MapProfileDetailSheet.tsx"),
        /href=\{`\/showroom\/\$\{profile\.profileId\}`\}/,
      );
      assert.match(
        readWeb("src/ui/community/DailyNoteApp.tsx"),
        /\/showroom\/\$\{/,
      );
      assert.match(
        readWeb("src/ui/community/CommunityApp.tsx"),
        /\/showroom\/\$\{/,
      );
      assert.match(
        readWeb("app/profile/[id]/page.tsx"),
        /href=\{`\/showroom\/\$\{data\.ownerId\}`\}/,
      );
      const mypage = readWeb("src/ui/home/HomeApp.tsx");
      assert.match(mypage, /\/showroom\/coupons/);
      assert.match(mypage, /canWriteShowroom\(profile\.role\)/);
      assert.match(mypage, /\/showroom\/manage/);
      const manage = readWeb("src/ui/showroom/ShowroomManageApp.tsx");
      assert.match(manage, /@\/domain\/showroom\/fromWorkplace/);
      assert.match(manage, /showroomLocationFromWorkplace/);
      assert.match(manage, /\/home\/profile\/edit/);
      assert.doesNotMatch(manage, /placeholder="예: 성수 블렌딩 로스터리"/);
      const list = readWeb("src/ui/showroom/ShowroomListApp.tsx");
      assert.match(list, /@\/domain\/showroom\/access/);
      assert.doesNotMatch(list, /@\/domain\/showroom\/timesale/);
      assert.match(readWeb("app/showroom/manage/page.tsx"), /canWriteShowroom/);
      for (const rel of [
        "app/api/showroom/route.ts",
        "app/api/showroom/mine/route.ts",
        "app/api/showroom/menus/route.ts",
        "app/api/showroom/menus/[menuId]/route.ts",
        "app/api/showroom/coupons/route.ts",
        "app/api/showroom/coupons/[couponId]/route.ts",
        "app/api/showroom/coupons/[couponId]/timesale-push/route.ts",
      ]) {
        assert.match(readWeb(rel), /canWriteShowroom/);
      }
    });

    it("indexes showroom collections without SQL and deletes them on withdrawal", () => {
      const source = readWeb("src/infrastructure/mongodb/indexes.ts");
      for (const collection of [
        "barista_showrooms",
        "menus",
        "coupons",
        "user_coupons",
        "member_last_locations",
      ]) {
        assert.match(source, new RegExp(`collection\\("${collection}"\\)`));
      }
      assert.match(source, /userId: 1, couponId: 1/);
      assert.match(source, /location: "2dsphere"/);
      assert.doesNotMatch(source, /CREATE TABLE|ALTER TABLE/i);
      assert.deepEqual(
        privateDeletionOperations("user-1").filter(([name]) =>
          [
            "barista_showrooms",
            "menus",
            "coupons",
            "user_coupons",
            "member_last_locations",
          ].includes(name),
        ),
        [
          ["barista_showrooms", { userId: "user-1" }],
          ["menus", { baristaId: "user-1" }],
          ["coupons", { baristaId: "user-1" }],
          ["user_coupons", { userId: "user-1" }],
          ["member_last_locations", { userId: "user-1" }],
        ],
      );
    });

    it("claims idempotently, honor-toggles USED, and sends Expo not raw FCM", () => {
      const repo = readWeb("src/infrastructure/server/showroomRepository.ts");
      assert.match(repo, /if \(existing\) \{\s*return toDomain\(existing\);/s);
      assert.match(
        repo,
        /if \(userCoupon\.status === "USED"\) \{\s*return toDomain\(userCoupon\);/s,
      );
      assert.doesNotMatch(repo, /\bPIN\b|\bQR\b|tosspayments|iamport/);
      const push = readWeb("src/infrastructure/server/timesalePush.ts");
      assert.match(push, /sendPushNotification/);
      assert.match(
        push,
        /href = `\/showroom\/\$\{showroom\.id\}\?coupon=\$\{coupon\.id\}`/,
      );
      assert.doesNotMatch(push, /fcm\.googleapis\.com/);
      assert.match(
        readWeb("src/infrastructure/server/pushNotifications.ts"),
        /https:\/\/exp\.host\/--\/api\/v2\/push\/send/,
      );
      const nav = readFileSync(
        join(webRoot, "../app/src/webViewNavigation.ts"),
        "utf8",
      );
      assert.match(nav, /"\/showroom"/);
    });
  });
}
