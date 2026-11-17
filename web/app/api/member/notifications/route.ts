import { type NextRequest, NextResponse } from "next/server";
import type { NotificationItem } from "@/domain/member/types";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";

type MarkNotificationsReadRequest = {
  href?: string;
};

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const input = await readJson<MarkNotificationsReadRequest>(request);
  const href = input.href?.trim();

  await ensureMongoIndexes();

  const db = await getMongoDb();
  const result = await db
    .collection<NotificationItem & { ownerId: string }>("member_notifications")
    .updateMany(
      {
        ownerId: user.id,
        unread: true,
        ...(href ? { href } : {}),
      },
      { $set: { unread: false } },
    );

  return NextResponse.json({
    success: true,
    modifiedCount: result.modifiedCount,
  });
}
