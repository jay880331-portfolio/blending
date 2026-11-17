import { type NextRequest, NextResponse } from "next/server";
import {
  type NotificationSettingKey,
  type NotificationSettings,
  defaultNotificationSettings,
} from "@/domain/member/types";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";

type NotificationSettingsDocument = {
  ownerId: string;
  settings: Partial<NotificationSettings> & {
    communityActivity?: boolean;
    communityReactions?: boolean;
  };
  updatedAt?: Date;
};

const settingKeys = Object.keys(
  defaultNotificationSettings,
) as NotificationSettingKey[];

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const settings = await readSettings(user.id);
  return NextResponse.json({ settings });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const patch = pickSettingsPatch(
    await readJson<Partial<NotificationSettings>>(request),
  );
  if (Object.keys(patch).length === 0)
    return jsonError("변경할 알림 설정을 선택해주세요.");

  await ensureMongoIndexes();
  const db = await getMongoDb();
  await db
    .collection<NotificationSettingsDocument>("member_notification_settings")
    .updateOne(
      { ownerId: user.id },
      {
        $set: {
          ...Object.fromEntries(
            Object.entries(patch).map(([key, value]) => [
              `settings.${key}`,
              value,
            ]),
          ),
          updatedAt: new Date(),
        },
        $setOnInsert: { ownerId: user.id },
      },
      { upsert: true },
    );

  const settings = await readSettings(user.id);
  return NextResponse.json({ success: true, settings });
}

async function readSettings(ownerId: string): Promise<NotificationSettings> {
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

function pickSettingsPatch(input: Partial<NotificationSettings>) {
  const patch: Partial<NotificationSettings> = {};

  settingKeys.forEach((key) => {
    if (key === "accountSecurity") return;
    if (typeof input[key] === "boolean") patch[key] = input[key];
  });

  return patch;
}
