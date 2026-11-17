import { NextResponse, type NextRequest } from "next/server";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { getCurrentUser } from "@/infrastructure/server/auth";
import {
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";

type PushTokenPlatform = "android" | "ios" | "web" | "unknown";

type PushTokenRequest = {
  token?: string;
  platform?: PushTokenPlatform;
};

type PushTokenDocument = {
  ownerId: string;
  token: string;
  platform: PushTokenPlatform;
  disabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const platforms = new Set<PushTokenPlatform>([
  "android",
  "ios",
  "web",
  "unknown",
]);

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const input = await readJson<PushTokenRequest>(request);
  const token = requireString(input.token);
  const platform = platforms.has(input.platform ?? "unknown")
    ? (input.platform ?? "unknown")
    : "unknown";

  if (!token) return jsonError("푸시 토큰이 필요합니다.");
  if (
    !token.startsWith("ExponentPushToken[") &&
    !token.startsWith("ExpoPushToken[")
  )
    return jsonError("지원하지 않는 푸시 토큰입니다.");

  await ensureMongoIndexes();
  const now = new Date();
  const db = await getMongoDb();

  await db.collection<PushTokenDocument>("member_push_tokens").updateOne(
    { token },
    {
      $set: {
        ownerId: user.id,
        platform,
        disabled: false,
        updatedAt: now,
      },
      $setOnInsert: {
        token,
        createdAt: now,
      },
    },
    { upsert: true },
  );

  return NextResponse.json({ success: true });
}
