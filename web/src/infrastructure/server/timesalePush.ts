import { MongoServerError, type Db } from "mongodb";
import { canIssueCoupon } from "@/domain/showroom/couponPolicy";
import { isNotificationEnabled } from "./pushNotifications";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { createId, nowIso } from "@/infrastructure/server/content";
import { sendPushNotificationReport } from "@/infrastructure/server/pushNotifications";
import type {
  BaristaShowroom,
  ShowroomCoupon,
  ShowroomLocation,
  TimesalePushResult,
} from "@/domain/showroom/types";

export class ConflictError extends Error {
  statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function findTimesaleRecipientUserIds({
  baristaId,
  storeLocation,
  audience = "both",
  database,
  now = new Date(),
}: {
  baristaId: string;
  storeLocation?: ShowroomLocation;
  audience?: "regulars" | "nearby" | "both";
  database?: Db;
  now?: Date;
}): Promise<string[]> {
  const db = database ?? (await getMongoDb());

  // 1. 단골 사용자 목록 (해당 바리스타를 즐겨찾기 등록한 애호가)
  const favorites = await db
    .collection<{ ownerId: string; id: string; deletedAt?: string }>(
      "member_favorites",
    )
    .find({ id: baristaId, deletedAt: { $exists: false } })
    .toArray();
  const regularUserIds = favorites
    .map((f) => f.ownerId)
    .filter((id) => Boolean(id) && id !== baristaId);

  // 2. 주변 위치 애호가 (opt-in + 최근 24시간 + 반경 3km)
  const nearbyUserIds: string[] = [];
  if (
    storeLocation &&
    typeof storeLocation.latitude === "number" &&
    typeof storeLocation.longitude === "number"
  ) {
    // opt-in 사용자 목록
    const optInSettings = await db
      .collection<{
        ownerId: string;
        settings?: { shareLocationForTimesale?: boolean };
      }>("member_notification_settings")
      .find({ "settings.shareLocationForTimesale": true })
      .project<{ ownerId: string }>({ ownerId: 1 })
      .toArray();
    const optInUserIds = new Set(optInSettings.map((s) => s.ownerId));

    if (optInUserIds.size > 0) {
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recentLocations = await db
        .collection<{
          userId: string;
          location: { coordinates: [number, number] };
          updatedAt: Date;
        }>("member_last_locations")
        .find({
          userId: { $in: Array.from(optInUserIds) },
          updatedAt: { $gte: twentyFourHoursAgo },
        })
        .toArray();

      for (const loc of recentLocations) {
        if (loc.userId === baristaId) continue;
        const [lng, lat] = loc.location.coordinates;
        const dist = calculateDistanceKm(
          storeLocation.latitude,
          storeLocation.longitude,
          lat,
          lng,
        );
        if (dist <= 3.0) {
          nearbyUserIds.push(loc.userId);
        }
      }
    }
  }

  // 합집합 반환 (발송자 본인 제외)
  const recipients = Array.from(
    new Set([
      ...(audience === "nearby" ? [] : regularUserIds),
      ...(audience === "regulars" ? [] : nearbyUserIds),
    ]),
  ).filter((id) => id !== baristaId);
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  const night = hour >= 21 || hour < 8;
  const settings = await db
    .collection("member_notification_settings")
    .find({
      ownerId: { $in: recipients },
      "settings.benefitsMarketing": true,
      ...(night ? { "settings.nightNotifications": true } : {}),
    })
    .toArray();
  const eligible = settings.map((setting) => setting.ownerId as string);
  const users = await db
    .collection("users")
    .find({
      id: { $in: eligible },
      $or: [{ accountStatus: "active" }, { accountStatus: { $exists: false } }],
    })
    .toArray();
  const active = new Set(users.map((user) => user.id as string));
  const limits = await db
    .collection<{ _id: string; nextAllowedAt: Date }>("coupon_push_frequency")
    .find({ _id: { $in: eligible }, nextAllowedAt: { $gt: now } })
    .toArray();
  const limited = new Set(limits.map((limit) => limit._id));
  return eligible.filter((id) => active.has(id) && !limited.has(id));
}

export async function sendTimesalePush({
  showroom,
  coupon,
  customTitle,
  customBody,
  audience = "both",
}: {
  showroom: BaristaShowroom;
  coupon: ShowroomCoupon;
  customTitle?: string;
  customBody?: string;
  audience?: "regulars" | "nearby" | "both";
}): Promise<TimesalePushResult> {
  if (coupon.couponType !== "timesale") {
    throw new Error("타임세일 쿠폰만 타임세일 푸시를 발송할 수 있습니다.");
  }

  // 재발송 쿨다운 검사: 이미 푸시를 발송한 이력이 있으면 409 Conflict
  if (coupon.lastPushedAt) {
    const pushedTime = new Date(coupon.lastPushedAt).getTime();
    const oneHour = 60 * 60 * 1000;
    if (Date.now() - pushedTime < oneHour) {
      throw new ConflictError(
        "이미 최근에 타임세일 푸시가 발송된 쿠폰입니다. 1시간 후에 다시 발송할 수 있습니다.",
      );
    }
  }

  if (!canIssueCoupon(coupon))
    throw new ConflictError("발급 가능한 쿠폰만 알림을 보낼 수 있습니다.");
  const pushTitle =
    customTitle?.trim() || `[타임세일] ${showroom.storeName} 깜짝 혜택!`;
  const pushBody =
    customBody?.trim() ||
    `${coupon.title} (${coupon.discountDetail}) 지금 쇼룸에서 확인하세요!`;
  if (pushTitle.length > 60 || pushBody.length > 200 || !pushTitle || !pushBody)
    throw new ConflictError(
      "알림 제목은 60자, 내용은 200자 이내로 입력해 주세요.",
    );
  const recipientUserIds = await findTimesaleRecipientUserIds({
    baristaId: showroom.userId,
    storeLocation: showroom.location,
    audience,
  });

  if (!recipientUserIds.length)
    return {
      success: true,
      recipientCount: 0,
      message: "수신 동의·위치·발송 간격 조건에 맞는 대상이 없습니다.",
    };
  const now = nowIso();
  const db = await getMongoDb();
  const locked = await db
    .collection<ShowroomCoupon>("coupons")
    .findOneAndUpdate(
      {
        id: coupon.id,
        validUntil: { $gt: now },
        issuanceStoppedAt: { $exists: false },
        $or: [
          { lastPushedAt: { $exists: false } },
          {
            lastPushedAt: {
              $lte: new Date(Date.now() - 3600000).toISOString(),
            },
          },
        ],
      },
      { $set: { lastPushedAt: now } },
      { returnDocument: "after" },
    );
  if (!locked)
    throw new ConflictError(
      "최근에 발송했거나 발급이 중단된 쿠폰입니다. 1시간 후 다시 확인해 주세요.",
    );
  const runId = createId("coupon_push");
  const href = `/showroom/${showroom.id}?coupon=${coupon.id}`;
  await db.collection("coupon_push_runs").insertOne({
    id: runId,
    couponId: coupon.id,
    ownerId: showroom.userId,
    title: pushTitle,
    body: pushBody,
    audience,
    targetCount: recipientUserIds.length,
    status: "PROCESSING",
    createdAt: now,
  });
  let acceptedCount = 0;
  let failedCount = 0;
  let suppressedCount = 0;
  const tickets: string[] = [];
  // ponytail: 요청당 20명씩 발송한다. 대량 캠페인은 전용 작업 큐로 전환.
  for (let index = 0; index < recipientUserIds.length; index += 20) {
    await Promise.all(
      recipientUserIds.slice(index, index + 20).map(async (userId) => {
        let reserved = false;
        let accepted = false;
        try {
          const claim = await db
            .collection<{
              _id: string;
              nextAllowedAt: Date;
              runId: string;
            }>("coupon_push_frequency")
            .findOneAndUpdate(
              {
                _id: userId,
                $or: [
                  { nextAllowedAt: { $lte: new Date() } },
                  { nextAllowedAt: { $exists: false } },
                ],
              },
              {
                $set: { nextAllowedAt: new Date(Date.now() + 86400000), runId },
              },
              { upsert: true, returnDocument: "after" },
            );
          if (!claim) {
            suppressedCount++;
            return;
          }
          reserved = true;
        } catch (error) {
          if (error instanceof MongoServerError && error.code === 11000) {
            suppressedCount++;
            return;
          }
          failedCount++;
          return;
        }
        try {
          // 발송 직전 수신 동의도 다시 확인한다.
          const enabled = await isNotificationEnabled(
            userId,
            "benefitsMarketing",
          );
          const hour = (new Date().getUTCHours() + 9) % 24;
          const nightEnabled =
            hour >= 21 || hour < 8
              ? await isNotificationEnabled(userId, "nightNotifications")
              : true;
          const active = await db.collection("users").findOne({
            id: userId,
            $or: [
              { accountStatus: "active" },
              { accountStatus: { $exists: false } },
            ],
          });
          if (!enabled || !nightEnabled || !active) {
            suppressedCount++;
            return;
          }
          const result = await sendPushNotificationReport(userId, {
            title: pushTitle,
            body: pushBody,
            data: { href },
          });
          acceptedCount += result.accepted;
          accepted = result.accepted > 0;
          failedCount += result.failed;
          if (!result.attempted && !result.failed) suppressedCount++;
          tickets.push(...result.tickets);
        } catch {
          failedCount++;
        } finally {
          if (reserved && !accepted) {
            await db
              .collection<{
                _id: string;
                runId: string;
              }>("coupon_push_frequency")
              .deleteOne({ _id: userId, runId });
          }
        }
      }),
    );
  }
  await db.collection("coupon_push_runs").updateOne(
    { id: runId },
    {
      $set: {
        status: failedCount ? "PARTIAL_FAILURE" : "SUBMITTED",
        acceptedCount,
        failedCount,
        suppressedCount,
        tickets,
        completedAt: nowIso(),
      },
    },
  );
  return {
    success: true,
    recipientCount: recipientUserIds.length,
    acceptedCount,
    failedCount,
    suppressedCount,
    runId,
    message: `대상 ${recipientUserIds.length}명 · 기기 전송 접수 ${acceptedCount}건 · 실패 ${failedCount}건 · 제외 ${suppressedCount}명 (기기 도착 보장 아님)`,
  };
}

export async function readCouponPushRun(ownerId: string, couponId: string) {
  const db = await getMongoDb();
  const run = await db
    .collection("coupon_push_runs")
    .findOne({ ownerId, couponId }, { sort: { createdAt: -1 } });
  if (!run) return null;
  // Expo 영수증은 APNs/FCM 전달 상태다. 사용자 표시·열람 상태는 아니다.
  if (
    Array.isArray(run.tickets) &&
    run.tickets.length &&
    Date.now() - Date.parse(run.createdAt) >= 15 * 60000 &&
    !run.receiptsCheckedAt
  ) {
    const data: Record<string, { status?: string }> = {};
    for (let offset = 0; offset < run.tickets.length; offset += 1000) {
      const response = await fetch(
        "https://exp.host/--/api/v2/push/getReceipts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ids: run.tickets.slice(offset, offset + 1000),
          }),
        },
      );
      if (!response.ok) break;
      const result = (await response.json()) as {
        data?: Record<string, { status?: string }>;
      };
      Object.assign(data, result.data ?? {});
    }
    const receiptAcceptedCount = Object.values(data).filter(
      (value) => value.status === "ok",
    ).length;
    const receiptFailedCount = Object.values(data).filter(
      (value) => value.status === "error",
    ).length;
    const receiptPendingCount = run.tickets.length - Object.keys(data).length;
    const receiptFields = {
      receiptAcceptedCount,
      receiptFailedCount,
      receiptPendingCount,
      ...(receiptPendingCount === 0 ? { receiptsCheckedAt: nowIso() } : {}),
    };
    await db
      .collection("coupon_push_runs")
      .updateOne({ id: run.id }, { $set: receiptFields });
    Object.assign(run, receiptFields);
  }
  return {
    id: run.id,
    status: run.status,
    targetCount: run.targetCount,
    acceptedCount: run.acceptedCount ?? 0,
    failedCount: run.failedCount ?? 0,
    suppressedCount: run.suppressedCount ?? 0,
    createdAt: run.createdAt,
    receiptAcceptedCount: run.receiptAcceptedCount ?? null,
    receiptFailedCount: run.receiptFailedCount ?? null,
    receiptPendingCount: run.receiptPendingCount ?? null,
  };
}
