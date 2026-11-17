import { type NextRequest, NextResponse } from "next/server";
import type { DirectChatRoomSetting } from "@/domain/member/types";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import {
  getCurrentUser,
  type UserDocument,
} from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";

type Params = Promise<{ counterpartId: string }>;

type ChatRoomSettingDocument = Omit<DirectChatRoomSetting, "leftAt"> & {
  ownerId: string;
  leftAt?: Date;
  updatedAt?: Date;
};

type ChatRoomSettingRequest = {
  blocked?: boolean;
  muted?: boolean;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Params },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const counterpartId = await readCounterpartId(params, user.id);
  if (!counterpartId) return jsonError("대화 상대를 선택해주세요.");

  const body = await readJson<ChatRoomSettingRequest>(request);
  const patch = pickSettingPatch(body);
  if (Object.keys(patch).length === 0)
    return jsonError("변경할 채팅방 설정을 선택해주세요.");

  await ensureMongoIndexes();

  const db = await getMongoDb();
  const counterpart = await db
    .collection<UserDocument>("users")
    .findOne({ id: counterpartId });
  if (!counterpart) return jsonError("대화 상대를 찾을 수 없습니다.", 404);

  await db.collection<ChatRoomSettingDocument>("member_chat_rooms").updateOne(
    { ownerId: user.id, counterpartId },
    {
      $set: {
        ...patch,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        ownerId: user.id,
        counterpartId,
      },
    },
    { upsert: true },
  );

  return NextResponse.json({
    success: true,
    setting: await readChatRoomSetting(user.id, counterpartId),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const counterpartId = await readCounterpartId(params, user.id);
  if (!counterpartId) return jsonError("대화 상대를 선택해주세요.");

  await ensureMongoIndexes();

  const db = await getMongoDb();
  const counterpart = await db
    .collection<UserDocument>("users")
    .findOne({ id: counterpartId });
  if (!counterpart) return jsonError("대화 상대를 찾을 수 없습니다.", 404);

  await db.collection<ChatRoomSettingDocument>("member_chat_rooms").updateOne(
    { ownerId: user.id, counterpartId },
    {
      $set: {
        leftAt: new Date(),
        updatedAt: new Date(),
      },
      $setOnInsert: {
        ownerId: user.id,
        counterpartId,
        blocked: false,
        muted: false,
      },
    },
    { upsert: true },
  );

  return NextResponse.json({ success: true });
}

async function readCounterpartId(params: Params, ownerId: string) {
  const { counterpartId } = await params;
  const decoded = decodeURIComponent(counterpartId).trim();
  if (!decoded || decoded === ownerId) return null;
  return decoded;
}

function pickSettingPatch(input: ChatRoomSettingRequest) {
  const patch: Partial<Pick<DirectChatRoomSetting, "blocked" | "muted">> = {};

  if (typeof input.blocked === "boolean") patch.blocked = input.blocked;
  if (typeof input.muted === "boolean") patch.muted = input.muted;

  return patch;
}

async function readChatRoomSetting(ownerId: string, counterpartId: string) {
  const db = await getMongoDb();
  const setting = await db
    .collection<ChatRoomSettingDocument>("member_chat_rooms")
    .findOne({ ownerId, counterpartId });

  return {
    counterpartId,
    blocked: Boolean(setting?.blocked),
    muted: Boolean(setting?.muted),
  } satisfies DirectChatRoomSetting;
}
