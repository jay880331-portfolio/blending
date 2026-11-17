import { type NextRequest, NextResponse } from "next/server";
import type { NotificationItem } from "@/domain/member/types";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError } from "@/infrastructure/server/http";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await params;
  await ensureMongoIndexes();

  const db = await getMongoDb();
  const result = await db
    .collection<NotificationItem & { ownerId: string }>("member_notifications")
    .deleteOne({ id, ownerId: user.id });

  if (result.deletedCount === 0)
    return jsonError("알림을 찾을 수 없습니다.", 404);

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await params;
  await ensureMongoIndexes();

  const db = await getMongoDb();
  const result = await db
    .collection<NotificationItem & { ownerId: string }>("member_notifications")
    .updateOne({ id, ownerId: user.id }, { $set: { unread: false } });

  if (result.matchedCount === 0)
    return jsonError("알림을 찾을 수 없습니다.", 404);

  return NextResponse.json({ success: true });
}
