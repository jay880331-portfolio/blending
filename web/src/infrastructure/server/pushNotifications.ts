import { after } from "next/server";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import {
  defaultNotificationSettings,
  type NotificationSettingKey,
  type NotificationSettings,
} from "@/domain/member/types";

type PushTokenDocument = {
  ownerId: string;
  token: string;
  disabled?: boolean;
};

type ExpoPushTicket = {
  id?: string;
  status?: "ok" | "error";
  details?: {
    error?: string;
  };
};

type ExpoPushResponse = {
  data?: ExpoPushTicket | ExpoPushTicket[];
};

type ExpoPushMessage = PushNotificationPayload & {
  to: string;
  sound: "default";
  channelId: "default";
  priority: "high";
};

type NotificationSettingsDocument = {
  ownerId: string;
  settings: Partial<NotificationSettings> & {
    communityActivity?: boolean;
    communityReactions?: boolean;
  };
};

export type PushNotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * 응답 반환 이후에도 푸시 전송이 끝까지 실행되도록 `after`로 예약한다.
 * (serverless에서 fire-and-forget `void` 호출은 응답 직후 중단될 수 있다.)
 * 요청 스코프 밖(단위 테스트 등)에서는 즉시 실행으로 대체한다.
 */
export function schedulePushNotification(
  ownerId: string,
  payload: PushNotificationPayload,
) {
  const task = () => sendPushNotification(ownerId, payload);
  try {
    after(task);
  } catch {
    void task();
  }
}

export function schedulePushNotificationIfEnabled(
  ownerId: string,
  settingKey: NotificationSettingKey,
  payload: PushNotificationPayload,
) {
  const task = () =>
    sendPushNotificationIfEnabled(ownerId, settingKey, payload);
  try {
    after(task);
  } catch {
    void task();
  }
}

export async function isNotificationEnabled(
  ownerId: string,
  settingKey: NotificationSettingKey,
) {
  const settings = await readNotificationSettings(ownerId);
  return settings[settingKey];
}

export async function sendPushNotificationIfEnabled(
  ownerId: string,
  settingKey: NotificationSettingKey,
  payload: PushNotificationPayload,
) {
  if (!(await isNotificationEnabled(ownerId, settingKey))) return;

  await sendPushNotification(ownerId, payload);
}

export async function sendPushNotification(
  ownerId: string,
  payload: PushNotificationPayload,
): Promise<void> {
  await sendPushNotificationReport(ownerId, payload);
}

export type PushSendReport = {
  attempted: number;
  accepted: number;
  failed: number;
  tickets: string[];
};
export async function sendPushNotificationReport(
  ownerId: string,
  payload: PushNotificationPayload,
): Promise<PushSendReport> {
  try {
    const db = await getMongoDb();
    const tokens = await db
      .collection<PushTokenDocument>("member_push_tokens")
      .find({ ownerId, disabled: { $ne: true } })
      .project<Pick<PushTokenDocument, "token">>({ token: 1, _id: 0 })
      .toArray();

    if (tokens.length === 0) {
      console.warn("[push] no active push token", { ownerId });
      return { attempted: 0, accepted: 0, failed: 0, tickets: [] };
    }

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
      },
      body: JSON.stringify(
        tokens.map<ExpoPushMessage>(({ token }) => ({
          to: token,
          sound: "default",
          channelId: "default",
          priority: "high",
          title: payload.title,
          body: payload.body,
          data: payload.data ?? {},
        })),
      ),
    });

    if (!response.ok) {
      console.warn("[push] expo push request failed", {
        ownerId,
        status: response.status,
      });
      return {
        attempted: tokens.length,
        accepted: 0,
        failed: tokens.length,
        tickets: [],
      };
    }

    const result = (await response.json()) as ExpoPushResponse;
    const tickets = Array.isArray(result.data)
      ? result.data
      : result.data
        ? [result.data]
        : [];
    const disabledTokens = tickets
      .map((ticket, index) =>
        ticket.details?.error === "DeviceNotRegistered"
          ? tokens[index]?.token
          : null,
      )
      .filter((token): token is string => Boolean(token));

    if (disabledTokens.length > 0) {
      await db
        .collection<PushTokenDocument>("member_push_tokens")
        .updateMany(
          { token: { $in: disabledTokens } },
          { $set: { disabled: true } },
        );
    }
    const errorTickets = tickets.filter((ticket) => ticket.status === "error");
    if (errorTickets.length > 0) {
      console.warn("[push] expo push ticket errors", {
        ownerId,
        errors: errorTickets.map(
          (ticket) => ticket.details?.error ?? "unknown",
        ),
      });
    }
    return {
      attempted: tokens.length,
      accepted: tickets.filter((t) => t.status === "ok").length,
      failed: Math.max(
        0,
        tokens.length - tickets.filter((t) => t.status === "ok").length,
      ),
      tickets: tickets.flatMap((t) =>
        t.status === "ok" && t.id ? [t.id] : [],
      ),
    };
  } catch (error) {
    // Push is best-effort. Keep source action successful.
    console.warn("[push] send failed", {
      ownerId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { attempted: 0, accepted: 0, failed: 1, tickets: [] };
  }
}

async function readNotificationSettings(
  ownerId: string,
): Promise<NotificationSettings> {
  const db = await getMongoDb();
  const document = await db
    .collection<NotificationSettingsDocument>("member_notification_settings")
    .findOne({ ownerId });
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
